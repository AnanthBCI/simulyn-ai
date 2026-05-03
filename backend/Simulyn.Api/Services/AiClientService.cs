using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Simulyn.Api.Models.Dtos;

namespace Simulyn.Api.Services;

public class AiClientService(HttpClient http)
{
    public async Task<AiPredictResponse?> PredictAsync(AiPredictRequest request, CancellationToken ct = default)
    {
        var res = await http.PostAsJsonAsync("/predict", request, ct);
        if (!res.IsSuccessStatusCode) return null;
        return await res.Content.ReadFromJsonAsync<AiPredictResponse>(cancellationToken: ct);
    }

    public async Task<AiSimulateResponse?> SimulateAsync(AiSimulateRequest request, CancellationToken ct = default)
    {
        var res = await http.PostAsJsonAsync("/simulate", request, ct);
        if (!res.IsSuccessStatusCode) return null;
        return await res.Content.ReadFromJsonAsync<AiSimulateResponse>(cancellationToken: ct);
    }

    /// <summary>
    /// One step of the chat-copilot tool-calling loop. Sends the full conversation
    /// (system + user + assistant tool_calls + tool results) plus the available tool
    /// schemas. The Python service returns either a tool_call or the final answer.
    /// </summary>
    public async Task<ChatStepResponseDto?> ChatStepAsync(ChatStepRequestDto request, CancellationToken ct = default)
    {
        var res = await http.PostAsJsonAsync("/chat-step", request, ct);
        if (!res.IsSuccessStatusCode) return null;
        return await res.Content.ReadFromJsonAsync<ChatStepResponseDto>(cancellationToken: ct);
    }

    /// <summary>
    /// Ask the AI service to generate a one-glance project health brief. The
    /// numeric health score is computed server-side by the AI service for
    /// determinism; the LLM only writes the narrative.
    /// </summary>
    public async Task<AiProjectBriefResponse?> GenerateProjectBriefAsync(AiProjectBriefRequest request, CancellationToken ct = default)
    {
        var res = await http.PostAsJsonAsync("/project-brief", request, ct);
        if (!res.IsSuccessStatusCode) return null;
        return await res.Content.ReadFromJsonAsync<AiProjectBriefResponse>(cancellationToken: ct);
    }

    /// <summary>
    /// Ask the AI service to write a short weekly recap across the active org's
    /// portfolio. Input is already aggregated; the LLM only narrates.
    /// </summary>
    public async Task<AiWeeklyRecapResponse?> GenerateWeeklyRecapAsync(AiWeeklyRecapRequest request, CancellationToken ct = default)
    {
        var res = await http.PostAsJsonAsync("/weekly-recap", request, ct);
        if (!res.IsSuccessStatusCode) return null;
        return await res.Content.ReadFromJsonAsync<AiWeeklyRecapResponse>(cancellationToken: ct);
    }

    /// <summary>
    /// Ask the AI service for a short list of scenarios worth simulating on a
    /// project, given its current state. The .NET side owns running the math.
    /// </summary>
    public async Task<AiAutoSuggestResponse?> AutoSuggestScenariosAsync(AiAutoSuggestRequest request, CancellationToken ct = default)
    {
        var res = await http.PostAsJsonAsync("/auto-suggest", request, ct);
        if (!res.IsSuccessStatusCode) return null;
        return await res.Content.ReadFromJsonAsync<AiAutoSuggestResponse>(cancellationToken: ct);
    }
}

public record AiPredictRequest(
    [property: JsonPropertyName("task_id")] string TaskId,
    [property: JsonPropertyName("task_name")] string TaskName,
    [property: JsonPropertyName("start_date")] string StartDate,
    [property: JsonPropertyName("end_date")] string EndDate,
    [property: JsonPropertyName("progress")] int Progress,
    [property: JsonPropertyName("project_start")] string ProjectStart,
    [property: JsonPropertyName("project_end")] string ProjectEnd);

public record AiPredictResponse(
    [property: JsonPropertyName("risk_level")] string RiskLevel,
    [property: JsonPropertyName("delay_days")] int DelayDays,
    [property: JsonPropertyName("summary")] string Summary,
    [property: JsonPropertyName("recommendation")] string Recommendation);

/// <summary>
/// Scenario-aware simulate payload. The .NET side computes the deterministic
/// <see cref="PredictedDelayDays"/> via <c>ScenarioMath</c>; the AI service
/// dresses the result in plain-English narrative.
/// <para>
/// <see cref="InputDelayDays"/> is kept for back-compat with pre-3A callers
/// that only passed uniform slips.
/// </para>
/// </summary>
public record AiSimulateRequest(
    [property: JsonPropertyName("project_id")] string ProjectId,
    [property: JsonPropertyName("project_start")] string ProjectStart,
    [property: JsonPropertyName("project_end")] string ProjectEnd,
    [property: JsonPropertyName("task_count")] int TaskCount,
    [property: JsonPropertyName("project_name")] string? ProjectName = null,
    [property: JsonPropertyName("scenario_type")] string? ScenarioType = null,
    [property: JsonPropertyName("config")] Dictionary<string, object?>? Config = null,
    [property: JsonPropertyName("predicted_delay_days")] int? PredictedDelayDays = null,
    [property: JsonPropertyName("deterministic_summary")] string? DeterministicSummary = null,
    [property: JsonPropertyName("signals")] Dictionary<string, object?>? Signals = null,
    [property: JsonPropertyName("input_delay_days")] int? InputDelayDays = null);

public record AiSimulateResponse(
    [property: JsonPropertyName("predicted_delay")] int PredictedDelay,
    [property: JsonPropertyName("impact_summary")] string ImpactSummary,
    [property: JsonPropertyName("headline")] string Headline,
    [property: JsonPropertyName("scenario_type")] string ScenarioType);

public record AiAutoSuggestTaskHint(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("progress")] int Progress);

public record AiAutoSuggestRequest(
    [property: JsonPropertyName("project_id")] string ProjectId,
    [property: JsonPropertyName("project_name")] string ProjectName,
    [property: JsonPropertyName("project_start")] string ProjectStart,
    [property: JsonPropertyName("project_end")] string ProjectEnd,
    [property: JsonPropertyName("task_count")] int TaskCount,
    [property: JsonPropertyName("high_risk_count")] int HighRiskCount,
    [property: JsonPropertyName("medium_risk_count")] int MediumRiskCount,
    [property: JsonPropertyName("low_risk_count")] int LowRiskCount,
    [property: JsonPropertyName("avg_progress")] int AvgProgress,
    [property: JsonPropertyName("expected_progress")] int ExpectedProgress,
    [property: JsonPropertyName("days_to_finish")] int DaysToFinish,
    [property: JsonPropertyName("tasks")] List<AiAutoSuggestTaskHint> Tasks);

public record AiSuggestedScenario(
    [property: JsonPropertyName("scenario_type")] string ScenarioType,
    [property: JsonPropertyName("label")] string Label,
    [property: JsonPropertyName("rationale")] string Rationale,
    [property: JsonPropertyName("config")] Dictionary<string, object?> Config);

public record AiAutoSuggestResponse(
    [property: JsonPropertyName("suggestions")] List<AiSuggestedScenario> Suggestions);

public record AiProjectBriefRequest(
    [property: JsonPropertyName("project_id")] string ProjectId,
    [property: JsonPropertyName("project_name")] string ProjectName,
    [property: JsonPropertyName("project_start")] string ProjectStart,
    [property: JsonPropertyName("project_end")] string ProjectEnd,
    [property: JsonPropertyName("task_count")] int TaskCount,
    [property: JsonPropertyName("high_risk_count")] int HighRiskCount,
    [property: JsonPropertyName("medium_risk_count")] int MediumRiskCount,
    [property: JsonPropertyName("low_risk_count")] int LowRiskCount,
    [property: JsonPropertyName("unpredicted_count")] int UnpredictedCount,
    [property: JsonPropertyName("avg_progress")] int AvgProgress,
    [property: JsonPropertyName("expected_progress")] int ExpectedProgress,
    [property: JsonPropertyName("days_to_finish")] int DaysToFinish);

public record AiProjectBriefResponse(
    [property: JsonPropertyName("headline")] string Headline,
    [property: JsonPropertyName("body")] string Body,
    [property: JsonPropertyName("health_score")] int HealthScore,
    [property: JsonPropertyName("tone_tags")] List<string> ToneTags);

public record AiWeeklyRecapProject(
    [property: JsonPropertyName("project_id")] string ProjectId,
    [property: JsonPropertyName("project_name")] string ProjectName,
    [property: JsonPropertyName("high_risk_count")] int HighRiskCount,
    [property: JsonPropertyName("medium_risk_count")] int MediumRiskCount,
    [property: JsonPropertyName("low_risk_count")] int LowRiskCount,
    [property: JsonPropertyName("unpredicted_count")] int UnpredictedCount,
    [property: JsonPropertyName("task_count")] int TaskCount,
    [property: JsonPropertyName("avg_progress")] int AvgProgress,
    [property: JsonPropertyName("expected_progress")] int ExpectedProgress,
    [property: JsonPropertyName("days_to_finish")] int DaysToFinish,
    [property: JsonPropertyName("high_risk_delta")] int HighRiskDelta);

public record AiWeeklyRecapRequest(
    [property: JsonPropertyName("organization_name")] string OrganizationName,
    [property: JsonPropertyName("project_count")] int ProjectCount,
    [property: JsonPropertyName("total_high_risk")] int TotalHighRisk,
    [property: JsonPropertyName("total_medium_risk")] int TotalMediumRisk,
    [property: JsonPropertyName("total_low_risk")] int TotalLowRisk,
    [property: JsonPropertyName("total_unpredicted")] int TotalUnpredicted,
    [property: JsonPropertyName("predictions_this_week")] int PredictionsThisWeek,
    [property: JsonPropertyName("high_risk_delta_week")] int HighRiskDeltaWeek,
    [property: JsonPropertyName("projects")] List<AiWeeklyRecapProject> Projects);

public record AiWeeklyRecapResponse(
    [property: JsonPropertyName("headline")] string Headline,
    [property: JsonPropertyName("bullets")] List<string> Bullets);
