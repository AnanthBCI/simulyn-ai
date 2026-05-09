using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Dtos;
using Simulyn.Api.Models.Entities;
using Simulyn.Api.Models.Scenarios;
using Simulyn.Api.Services;

namespace Simulyn.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
[EnableRateLimiting("simulation")]
public class SimulationsController(
    AppDbContext db,
    AiClientService ai,
    OrganizationContext orgContext,
    AiEntitlement aiEntitlement) : ControllerBase
{
    private static readonly JsonSerializerOptions _jsonOpts = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Run one what-if scenario on a project. Accepts either the modern
    /// scenario-aware payload (<see cref="RunScenarioRequest"/>) or the
    /// legacy <see cref="RunSimulationRequest"/> (<c>{ projectId, inputDelayDays }</c>)
    /// which is treated as a UniformSlip.
    /// </summary>
    [HttpPost("simulation")]
    public async Task<ActionResult<SimulationResultDto>> Run(
        [FromBody] JsonElement body,
        CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var roleErr = await orgContext.RequireRoleAsync(OrgRoles.Member, ct);
        if (roleErr != null) return roleErr;

        var guard = await aiEntitlement.GuardAsync(orgId!.Value, Response, ct);
        if (guard != null) return guard;

        // Accept either the new (scenarioType + config) shape or the legacy shape.
        var parsed = ParseScenarioRequest(body);
        if (parsed is null)
            return BadRequest("Invalid scenario payload. Expected { projectId, scenarioType, config } or legacy { projectId, inputDelayDays }.");

        var project = await LoadProjectAsync(parsed.ProjectId, orgId.Value, ct);
        if (project == null) return NotFound();

        var result = await RunOneAsync(project, parsed, ct);
        db.Simulations.Add(result.Entity);
        await db.SaveChangesAsync(ct);
        await aiEntitlement.RecordAsync(orgId.Value, UsageEventKinds.Simulation, UsageService.SimulationCostMills, ct);
        return Ok(result.Dto);
    }

    /// <summary>
    /// Run several scenarios on the same project in parallel and return all
    /// results in the same order they were requested. Used by the side-by-side
    /// comparison view on /simulation.
    /// </summary>
    [HttpPost("simulation/compare")]
    public async Task<ActionResult<CompareScenariosResponse>> Compare(
        [FromBody] CompareScenariosRequest req,
        CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var roleErr = await orgContext.RequireRoleAsync(OrgRoles.Member, ct);
        if (roleErr != null) return roleErr;

        var guard = await aiEntitlement.GuardAsync(orgId!.Value, Response, ct);
        if (guard != null) return guard;

        if (req.Scenarios.Count == 0)
            return BadRequest("At least one scenario is required.");
        if (req.Scenarios.Count > 8)
            return BadRequest("Cap is 8 scenarios per comparison.");

        var project = await LoadProjectAsync(req.ProjectId, orgId.Value, ct);
        if (project == null) return NotFound();

        // Run all scenarios against the AI service in parallel. The math is
        // pure and cheap; the LLM narrative is the slow part, so parallelism
        // matters for wall-clock UX.
        var tasks = req.Scenarios.Select(s => RunOneAsync(project, s, ct)).ToList();
        var results = await Task.WhenAll(tasks);

        // Persist all results (append-only history).
        foreach (var r in results) db.Simulations.Add(r.Entity);
        await db.SaveChangesAsync(ct);
        await aiEntitlement.RecordAsync(orgId.Value, UsageEventKinds.Simulation, UsageService.SimulationCostMills * results.Length, ct);

        return Ok(new CompareScenariosResponse(
            req.ProjectId,
            results.Select(r => r.Dto).ToList()));
    }

    /// <summary>
    /// Ask the AI service which scenarios are worth running on a project
    /// right now, given the current risk distribution and progress gap.
    /// </summary>
    [HttpPost("simulation/auto-suggest")]
    public async Task<ActionResult<AutoSuggestScenariosResponse>> AutoSuggest(
        [FromQuery] Guid projectId,
        CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var roleErr = await orgContext.RequireRoleAsync(OrgRoles.Member, ct);
        if (roleErr != null) return roleErr;

        var guard = await aiEntitlement.GuardAsync(orgId!.Value, Response, ct);
        if (guard != null) return guard;

        var project = await LoadProjectAsync(projectId, orgId.Value, ct);
        if (project == null) return NotFound();

        int high = 0, med = 0, low = 0;
        var progressSum = 0;
        foreach (var t in project.Tasks)
        {
            progressSum += t.Progress;
            var last = t.Predictions.OrderByDescending(x => x.CreatedAt).FirstOrDefault();
            switch (last?.RiskLevel)
            {
                case "High": high++; break;
                case "Medium": med++; break;
                case "Low": low++; break;
            }
        }
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var totalDays = Math.Max(1, project.EndDate.DayNumber - project.StartDate.DayNumber);
        var elapsed = Math.Clamp(today.DayNumber - project.StartDate.DayNumber, 0, totalDays);
        var expected = (int)Math.Round(100.0 * elapsed / totalDays);
        var daysToFinish = project.EndDate.DayNumber - today.DayNumber;
        var avgProgress = project.Tasks.Count == 0 ? 0 : progressSum / project.Tasks.Count;

        var taskHints = project.Tasks
            .OrderByDescending(t => t.Predictions.Any(p => p.RiskLevel == "High") ? 1 : 0)
            .ThenByDescending(t => t.Progress) // prefer mid-progress tasks as slip candidates
            .Take(6)
            .Select(t => new AiAutoSuggestTaskHint(t.Id.ToString(), t.Name, t.Progress))
            .ToList();

        var aiReq = new AiAutoSuggestRequest(
            project.Id.ToString(),
            project.Name,
            project.StartDate.ToString("yyyy-MM-dd"),
            project.EndDate.ToString("yyyy-MM-dd"),
            project.Tasks.Count,
            high, med, low,
            avgProgress, expected, daysToFinish,
            taskHints);

        AiAutoSuggestResponse? aiRes = null;
        try { aiRes = await ai.AutoSuggestScenariosAsync(aiReq, ct); }
        catch { /* fall through to deterministic suggestions below */ }
        if (aiRes != null)
        {
            // Auto-suggest is one LLM call (cheaper than running a real scenario).
            await aiEntitlement.RecordAsync(orgId.Value, UsageEventKinds.Simulation, UsageService.SimulationCostMills, ct);
        }

        var suggestions = aiRes?.Suggestions is { Count: > 0 }
            ? aiRes.Suggestions.Select(s => new SuggestedScenarioDto(
                s.ScenarioType,
                s.Label,
                s.Rationale,
                ConvertConfig(s.Config))).ToList()
            : DeterministicSuggestions(project, high, med, low, expected, avgProgress, daysToFinish);

        return Ok(new AutoSuggestScenariosResponse(project.Id, suggestions));
    }

    // --- helpers --------------------------------------------------------

    private async Task<Project?> LoadProjectAsync(Guid projectId, Guid orgId, CancellationToken ct)
    {
        return await db.Projects
            .Include(p => p.Tasks).ThenInclude(t => t.Predictions)
            .FirstOrDefaultAsync(p => p.Id == projectId && p.OrganizationId == orgId, ct);
    }

    private async Task<(Simulation Entity, SimulationResultDto Dto)> RunOneAsync(
        Project project,
        RunScenarioRequest req,
        CancellationToken ct)
    {
        var snapshot = ToSnapshot(project);
        var config = ParseConfig(req.ScenarioType, req.Config);
        var outcome = ScenarioMath.Run(snapshot, config, DateOnly.FromDateTime(DateTime.UtcNow));

        var aiReq = new AiSimulateRequest(
            project.Id.ToString(),
            project.StartDate.ToString("yyyy-MM-dd"),
            project.EndDate.ToString("yyyy-MM-dd"),
            project.Tasks.Count,
            ProjectName: project.Name,
            ScenarioType: req.ScenarioType,
            Config: JsonToDict(req.Config),
            PredictedDelayDays: outcome.PredictedDelayDays,
            DeterministicSummary: outcome.DeterministicSummary,
            Signals: outcome.Signals.ToDictionary(kv => kv.Key, kv => (object?)kv.Value),
            InputDelayDays: config is UniformSlipConfig u ? u.InputDelayDays : null);

        string headline = $"{ScenarioTypes.Label(req.ScenarioType)} → {outcome.PredictedDelayDays:+0;-0;0}d";
        string impact = outcome.DeterministicSummary;
        try
        {
            var aiRes = await ai.SimulateAsync(aiReq, ct);
            if (aiRes != null)
            {
                if (!string.IsNullOrWhiteSpace(aiRes.Headline)) headline = aiRes.Headline;
                if (!string.IsNullOrWhiteSpace(aiRes.ImpactSummary)) impact = aiRes.ImpactSummary;
            }
        }
        catch { /* keep deterministic fallback */ }

        // Persist — legacy InputDelay column is filled for UniformSlip so old
        // code paths that read it keep working.
        var legacyInputDelay = config is UniformSlipConfig us ? us.InputDelayDays : 0;
        var entity = new Simulation
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            InputDelay = legacyInputDelay,
            PredictedDelay = outcome.PredictedDelayDays,
            ImpactSummary = impact,
            CreatedAt = DateTime.UtcNow,
            ScenarioType = req.ScenarioType,
            ScenarioConfig = req.Config.ValueKind == JsonValueKind.Undefined
                ? null
                : req.Config.GetRawText(),
            Headline = headline,
        };

        var dto = new SimulationResultDto(
            entity.Id,
            entity.ProjectId,
            entity.InputDelay,
            entity.PredictedDelay,
            entity.ImpactSummary,
            entity.CreatedAt,
            entity.ScenarioType,
            entity.Headline,
            entity.ScenarioConfig);

        return (entity, dto);
    }

    private static ScenarioProjectSnapshot ToSnapshot(Project p) => new(
        p.Id,
        p.Name,
        p.StartDate,
        p.EndDate,
        p.Tasks.Select(t => new ScenarioTaskSnapshot(t.Id, t.Name, t.StartDate, t.EndDate, t.Progress)).ToList());

    private static ScenarioConfig ParseConfig(string scenarioType, JsonElement config)
    {
        try
        {
            return scenarioType switch
            {
                ScenarioTypes.UniformSlip => new UniformSlipConfig(
                    GetInt(config, "InputDelayDays") ?? GetInt(config, "inputDelayDays") ?? 0),
                ScenarioTypes.SingleTaskSlip => new SingleTaskSlipConfig(
                    GetGuid(config, "TaskId") ?? GetGuid(config, "taskId") ?? Guid.Empty,
                    GetInt(config, "DelayDays") ?? GetInt(config, "delayDays") ?? 0),
                ScenarioTypes.AddResource => new AddResourceConfig(
                    GetDouble(config, "CapacityMultiplier") ?? GetDouble(config, "capacityMultiplier") ?? 0.25),
                ScenarioTypes.WeatherPause => new WeatherPauseConfig(
                    GetInt(config, "PauseDays") ?? GetInt(config, "pauseDays") ?? 0),
                ScenarioTypes.ScopeReduction => new ScopeReductionConfig(
                    GetInt(config, "TasksRemoved") ?? GetInt(config, "tasksRemoved") ?? 0),
                _ => throw new ArgumentOutOfRangeException(nameof(scenarioType), $"Unknown scenario type: {scenarioType}"),
            };
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException)
        {
            throw new ArgumentException($"Invalid config JSON for scenario '{scenarioType}': {ex.Message}", ex);
        }
    }

    private static int? GetInt(JsonElement e, string name)
        => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number
            ? v.GetInt32() : (int?)null;

    private static double? GetDouble(JsonElement e, string name)
        => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number
            ? v.GetDouble() : (double?)null;

    private static Guid? GetGuid(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return null;
        if (v.ValueKind == JsonValueKind.String && Guid.TryParse(v.GetString(), out var g)) return g;
        return null;
    }

    private static Dictionary<string, object?>? JsonToDict(JsonElement e)
    {
        if (e.ValueKind != JsonValueKind.Object) return null;
        var dict = new Dictionary<string, object?>();
        foreach (var prop in e.EnumerateObject())
        {
            dict[prop.Name] = prop.Value.ValueKind switch
            {
                JsonValueKind.Number => prop.Value.TryGetInt64(out var l) ? l : prop.Value.GetDouble(),
                JsonValueKind.String => prop.Value.GetString(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Null => null,
                _ => prop.Value.GetRawText(),
            };
        }
        return dict;
    }

    private static JsonElement ConvertConfig(Dictionary<string, object?> config)
    {
        var json = JsonSerializer.Serialize(config, _jsonOpts);
        return JsonDocument.Parse(json).RootElement.Clone();
    }

    /// <summary>Parse either the new scenario-aware shape or the legacy one.</summary>
    private static RunScenarioRequest? ParseScenarioRequest(JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object) return null;

        var projectId = GetGuid(body, "projectId") ?? GetGuid(body, "ProjectId");
        if (projectId is null) return null;

        var scenarioType = body.TryGetProperty("scenarioType", out var stProp) ? stProp.GetString()
            : body.TryGetProperty("ScenarioType", out var stProp2) ? stProp2.GetString()
            : null;

        if (!string.IsNullOrWhiteSpace(scenarioType) && ScenarioTypes.IsKnown(scenarioType))
        {
            var config = body.TryGetProperty("config", out var cfg) ? cfg
                : body.TryGetProperty("Config", out var cfg2) ? cfg2
                : default;
            return new RunScenarioRequest(projectId.Value, scenarioType!, config.Clone());
        }

        // Legacy fallback — treat {projectId, inputDelayDays} as UniformSlip.
        var legacyDelay = GetInt(body, "inputDelayDays") ?? GetInt(body, "InputDelayDays");
        if (legacyDelay is null) return null;
        var legacyConfig = JsonDocument.Parse($"{{\"InputDelayDays\":{legacyDelay.Value}}}").RootElement.Clone();
        return new RunScenarioRequest(projectId.Value, ScenarioTypes.UniformSlip, legacyConfig);
    }

    private static List<SuggestedScenarioDto> DeterministicSuggestions(
        Project project, int high, int med, int low, int expected, int avgProgress, int daysToFinish)
    {
        var list = new List<SuggestedScenarioDto>
        {
            new(ScenarioTypes.UniformSlip,
                "What if every task slips 5 days?",
                "A conservative baseline — small, uniform slippage across trades.",
                JsonDocument.Parse("{\"InputDelayDays\":5}").RootElement.Clone()),
            new(ScenarioTypes.WeatherPause,
                "What if a 7-day weather pause hits?",
                "Sites with outdoor exposure should size the hit of a bad-weather week.",
                JsonDocument.Parse("{\"PauseDays\":7}").RootElement.Clone()),
        };
        if (expected - avgProgress >= 10)
        {
            list.Add(new SuggestedScenarioDto(
                ScenarioTypes.AddResource,
                "What if we add 25% crew capacity?",
                "Progress is behind plan; adding crew tests whether that recovers the slip.",
                JsonDocument.Parse("{\"CapacityMultiplier\":0.25}").RootElement.Clone()));
        }
        var slipCandidate = project.Tasks.OrderByDescending(t => t.Progress > 0 && t.Progress < 100 ? 1 : 0).FirstOrDefault();
        if (slipCandidate != null)
        {
            var cfg = JsonDocument.Parse(
                $"{{\"TaskId\":\"{slipCandidate.Id}\",\"DelayDays\":5}}").RootElement.Clone();
            list.Add(new SuggestedScenarioDto(
                ScenarioTypes.SingleTaskSlip,
                $"What if \"{slipCandidate.Name}\" slips 5 days?",
                "Isolating one task surfaces how critical-path sensitive the plan is.",
                cfg));
        }
        if (project.Tasks.Count >= 10)
        {
            list.Add(new SuggestedScenarioDto(
                ScenarioTypes.ScopeReduction,
                "What if we drop 2 tasks from scope?",
                "Pressure test the schedule win from light de-scoping.",
                JsonDocument.Parse("{\"TasksRemoved\":2}").RootElement.Clone()));
        }
        return list.Take(4).ToList();
    }
}
