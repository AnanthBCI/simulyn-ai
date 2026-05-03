using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Dtos;
using Simulyn.Api.Models.Entities;
using Simulyn.Api.Services;

namespace Simulyn.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ProjectsController(
    AppDbContext db,
    ExcelScheduleImportService import,
    PredictionService predictions,
    SampleProjectService sample,
    BillingService billing,
    AiClientService ai,
    OrganizationContext orgContext) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>
    /// Cached AI-generated project health brief is considered fresh for this
    /// long. Beyond it we re-render — unless the caller passes ?refresh=true.
    /// </summary>
    private static readonly TimeSpan BriefCacheWindow = TimeSpan.FromHours(12);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProjectDto>>> List(CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;

        var projects = await db.Projects
            .AsNoTracking()
            .Where(p => p.OrganizationId == orgId)
            .Include(p => p.Tasks).ThenInclude(t => t.Predictions)
            .ToListAsync(ct);

        return Ok(projects.Select(ToDto));
    }

    [HttpPost]
    public async Task<ActionResult<ProjectDto>> Create([FromBody] CreateProjectRequest req, CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var roleErr = await orgContext.RequireRoleAsync(OrgRoles.Member, ct);
        if (roleErr != null) return roleErr;

        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest("Name required.");
        var project = new Project
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId!.Value,
            CreatedByUserId = UserId,
            Name = req.Name.Trim(),
            StartDate = req.StartDate,
            EndDate = req.EndDate,
            Status = string.IsNullOrWhiteSpace(req.Status) ? "Active" : req.Status!,
            CreatedAt = DateTime.UtcNow,
        };
        db.Projects.Add(project);
        await db.SaveChangesAsync(ct);
        return Ok(new ProjectDto(project.Id, project.Name, project.StartDate, project.EndDate, project.Status, 0, 0));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProjectDto>> Update(Guid id, [FromBody] UpdateProjectRequest req, CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var roleErr = await orgContext.RequireRoleAsync(OrgRoles.Member, ct);
        if (roleErr != null) return roleErr;

        var p = await db.Projects.Include(x => x.Tasks).ThenInclude(t => t.Predictions)
            .FirstOrDefaultAsync(x => x.Id == id && x.OrganizationId == orgId, ct);
        if (p == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(req.Name)) p.Name = req.Name.Trim();
        if (req.StartDate.HasValue) p.StartDate = req.StartDate.Value;
        if (req.EndDate.HasValue) p.EndDate = req.EndDate.Value;
        if (!string.IsNullOrWhiteSpace(req.Status)) p.Status = req.Status!.Trim();

        await db.SaveChangesAsync(ct);
        return Ok(ToDto(p));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var roleErr = await orgContext.RequireRoleAsync(OrgRoles.Admin, ct);
        if (roleErr != null) return roleErr;

        var p = await db.Projects.FirstOrDefaultAsync(x => x.Id == id && x.OrganizationId == orgId, ct);
        if (p == null) return NotFound();
        db.Projects.Remove(p);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectDto>> Get(Guid id, CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;

        var p = await db.Projects.AsNoTracking()
            .Include(x => x.Tasks).ThenInclude(t => t.Predictions)
            .FirstOrDefaultAsync(x => x.Id == id && x.OrganizationId == orgId, ct);
        if (p == null) return NotFound();
        return Ok(ToDto(p));
    }

    /// <summary>
    /// One-glance AI narrative for a project: headline + 2-3 sentence body +
    /// 0-100 health score. Cached for <see cref="BriefCacheWindow"/>; pass
    /// <c>?refresh=true</c> to force regeneration (idempotent overwrite).
    /// </summary>
    [HttpGet("{id:guid}/brief")]
    public async Task<ActionResult<ProjectBriefDto>> GetBrief(
        Guid id,
        [FromQuery] bool refresh,
        CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;

        var project = await db.Projects
            .Include(p => p.Tasks).ThenInclude(t => t.Predictions)
            .FirstOrDefaultAsync(p => p.Id == id && p.OrganizationId == orgId, ct);
        if (project == null) return NotFound();

        var cached = await db.ProjectBriefs.FirstOrDefaultAsync(b => b.ProjectId == id, ct);
        var fresh = cached != null && (DateTime.UtcNow - cached.CreatedAt) < BriefCacheWindow;
        if (cached != null && fresh && !refresh)
        {
            return Ok(ToBriefDto(cached, isStale: false));
        }

        var aiReq = BuildBriefRequest(project);
        AiProjectBriefResponse? aiRes = null;
        try { aiRes = await ai.GenerateProjectBriefAsync(aiReq, ct); }
        catch { /* Fall through to deterministic fallback; don't fail the request. */ }

        var (headline, body, score, tags) = ResolveBrief(project, aiReq, aiRes);

        if (cached == null)
        {
            cached = new ProjectBrief { Id = Guid.NewGuid(), ProjectId = project.Id };
            db.ProjectBriefs.Add(cached);
        }
        cached.Headline = Truncate(headline, 300);
        cached.Body = Truncate(body, 2000);
        cached.HealthScore = Math.Clamp(score, 0, 100);
        cached.ToneTags = System.Text.Json.JsonSerializer.Serialize(tags);
        cached.CreatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return Ok(ToBriefDto(cached, isStale: aiRes == null));
    }

    private static AiProjectBriefRequest BuildBriefRequest(Project p)
    {
        var high = 0; var med = 0; var low = 0; var unpred = 0;
        var progressSum = 0;
        foreach (var t in p.Tasks)
        {
            progressSum += t.Progress;
            var last = t.Predictions.OrderByDescending(x => x.CreatedAt).FirstOrDefault();
            if (last == null) { unpred++; continue; }
            switch (last.RiskLevel)
            {
                case "High": high++; break;
                case "Medium": med++; break;
                case "Low": low++; break;
                default: unpred++; break;
            }
        }
        var taskCount = p.Tasks.Count;
        var avgProgress = taskCount > 0 ? progressSum / taskCount : 0;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = p.StartDate;
        var end = p.EndDate;
        var totalDays = Math.Max(1, end.DayNumber - start.DayNumber);
        var elapsed = Math.Clamp(today.DayNumber - start.DayNumber, 0, totalDays);
        var expected = (int)Math.Round(100.0 * elapsed / totalDays);
        var daysToFinish = end.DayNumber - today.DayNumber;

        return new AiProjectBriefRequest(
            p.Id.ToString(),
            p.Name,
            p.StartDate.ToString("yyyy-MM-dd"),
            p.EndDate.ToString("yyyy-MM-dd"),
            taskCount,
            high, med, low, unpred,
            avgProgress,
            expected,
            daysToFinish);
    }

    private static (string headline, string body, int score, List<string> tags) ResolveBrief(
        Project project,
        AiProjectBriefRequest req,
        AiProjectBriefResponse? res)
    {
        if (res != null)
        {
            return (
                string.IsNullOrWhiteSpace(res.Headline) ? FallbackHeadline(project, req) : res.Headline,
                string.IsNullOrWhiteSpace(res.Body) ? FallbackBody(req) : res.Body,
                res.HealthScore,
                res.ToneTags ?? new List<string>());
        }
        // Fallback when the AI service is unreachable. Keep a plausible score so
        // the UI doesn't scream red — deterministic math mirrors the Python side.
        return (
            FallbackHeadline(project, req),
            FallbackBody(req),
            DeterministicHealthScore(req),
            DeterministicTags(req));
    }

    private static string FallbackHeadline(Project p, AiProjectBriefRequest req)
    {
        if (req.TaskCount == 0) return $"{p.Name}: no tasks yet.";
        var score = DeterministicHealthScore(req);
        var status = score >= 80 ? "on track" : score >= 55 ? "needs attention" : "at risk";
        return $"{p.Name}: {status}";
    }

    private static string FallbackBody(AiProjectBriefRequest req)
    {
        if (req.TaskCount == 0)
            return "Add tasks or import a schedule to start tracking risk and progress.";
        var parts = new List<string>
        {
            $"Average progress {req.AvgProgress}% vs expected {req.ExpectedProgress}%.",
        };
        if (req.HighRiskCount > 0)
            parts.Add($"{req.HighRiskCount} task(s) at High risk, {req.MediumRiskCount} at Medium.");
        parts.Add(req.DaysToFinish >= 0
            ? $"{req.DaysToFinish} day(s) to planned finish."
            : $"{-req.DaysToFinish} day(s) past the planned finish.");
        return string.Join(" ", parts);
    }

    private static int DeterministicHealthScore(AiProjectBriefRequest req)
    {
        var total = Math.Max(req.TaskCount, 1);
        var highRatio = (double)req.HighRiskCount / total;
        var medRatio = (double)req.MediumRiskCount / total;
        var unpredRatio = (double)req.UnpredictedCount / total;
        var riskPenalty = 100.0 * highRatio + 40.0 * medRatio + 15.0 * unpredRatio;
        var riskScore = Math.Max(0.0, 100.0 - riskPenalty);
        var gap = Math.Max(0, req.ExpectedProgress - req.AvgProgress);
        var progressScore = Math.Max(0.0, 100.0 - gap * 2.0);
        double cushionScore;
        if (req.DaysToFinish >= 14) cushionScore = 100.0;
        else if (req.DaysToFinish >= 0) cushionScore = 60.0 + (req.DaysToFinish / 14.0) * 40.0;
        else cushionScore = Math.Max(0.0, 60.0 + req.DaysToFinish * 3.0);
        var score = 0.4 * riskScore + 0.4 * progressScore + 0.2 * cushionScore;
        return (int)Math.Round(Math.Clamp(score, 0.0, 100.0));
    }

    private static List<string> DeterministicTags(AiProjectBriefRequest req)
    {
        var score = DeterministicHealthScore(req);
        var tags = new List<string> { score >= 80 ? "On track" : score >= 55 ? "Watch" : "At risk" };
        if (req.HighRiskCount > 0)
            tags.Add($"{req.HighRiskCount} high-risk task{(req.HighRiskCount == 1 ? "" : "s")}");
        if (req.AvgProgress + 10 < req.ExpectedProgress) tags.Add("Behind schedule");
        if (req.DaysToFinish < 0) tags.Add("Past planned end");
        else if (req.DaysToFinish <= 7) tags.Add("Finish week");
        return tags.Take(4).ToList();
    }

    private static string Truncate(string s, int max) =>
        string.IsNullOrEmpty(s) ? string.Empty : (s.Length <= max ? s : s.Substring(0, max));

    private static ProjectBriefDto ToBriefDto(ProjectBrief b, bool isStale)
    {
        List<string> tags;
        try
        {
            tags = System.Text.Json.JsonSerializer.Deserialize<List<string>>(b.ToneTags) ?? new();
        }
        catch { tags = new(); }
        return new ProjectBriefDto(b.ProjectId, b.Headline, b.Body, b.HealthScore, tags, b.CreatedAt, isStale);
    }

    [HttpPost("sample")]
    public async Task<ActionResult<ProjectDto>> CreateSample(CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var roleErr = await orgContext.RequireRoleAsync(OrgRoles.Member, ct);
        if (roleErr != null) return roleErr;

        var p = await sample.CreateAndPredictAsync(orgId!.Value, UserId, SampleProjectService.SampleScenario.Mixed, ct);
        var fresh = await db.Projects.AsNoTracking()
            .Include(x => x.Tasks).ThenInclude(t => t.Predictions)
            .FirstAsync(x => x.Id == p.Id, ct);
        return Ok(ToDto(fresh));
    }

    /// <summary>
    /// Seeds 4 demo projects (Healthy / Trouble / JustStarted / NearComplete)
    /// in the active org and runs predictions on each. Useful for first-run
    /// demos and for testing multi-project workflows. Synchronous and slow on
    /// local Ollama (~2-3 minutes for ~54 tasks total).
    /// </summary>
    [HttpPost("sample-bundle")]
    public async Task<ActionResult<IEnumerable<ProjectDto>>> CreateSampleBundle(CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var roleErr = await orgContext.RequireRoleAsync(OrgRoles.Member, ct);
        if (roleErr != null) return roleErr;

        var created = await sample.CreateDemoBundleAsync(orgId!.Value, UserId, ct);
        var ids = created.Select(p => p.Id).ToList();

        var fresh = await db.Projects.AsNoTracking()
            .Include(x => x.Tasks).ThenInclude(t => t.Predictions)
            .Where(p => ids.Contains(p.Id))
            .ToListAsync(ct);

        return Ok(fresh.Select(ToDto));
    }

    [HttpGet("import-template")]
    [AllowAnonymous]
    public IActionResult DownloadImportTemplate()
    {
        var bytes = ExcelScheduleImportService.BuildTemplate();
        return File(
            bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "simulyn-schedule-template.xlsx");
    }

    [HttpPost("{id:guid}/import-schedule")]
    [RequestSizeLimit(20_000_000)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ImportScheduleResultDto>> ImportSchedule(Guid id, IFormFile? file, CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var roleErr = await orgContext.RequireRoleAsync(OrgRoles.Member, ct);
        if (roleErr != null) return roleErr;

        if (file == null || file.Length == 0)
            return BadRequest("Excel file is required.");
        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest("Upload a .xlsx file (Excel workbook).");

        await using var stream = file.OpenReadStream();
        try
        {
            var result = await import.ImportAsync(id, orgId!.Value, stream, ct);

            if (result.TasksCreated > 0 && await billing.IsEntitledAsync(orgId.Value, ct))
            {
                try { await predictions.RunForProjectAsync(id, orgId.Value, ct); }
                catch { /* Don't fail the import if AI is briefly unavailable. */ }
            }
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private static ProjectDto ToDto(Project p)
    {
        var high = p.Tasks.Count(t =>
        {
            var last = t.Predictions.OrderByDescending(x => x.CreatedAt).FirstOrDefault();
            return last?.RiskLevel == "High";
        });
        return new ProjectDto(p.Id, p.Name, p.StartDate, p.EndDate, p.Status, p.Tasks.Count, high);
    }
}
