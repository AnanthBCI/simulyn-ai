using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Simulyn.Api.Models.Dtos;

namespace Simulyn.Api.Services;

public class AiClientService(HttpClient http, ILogger<AiClientService> logger)
{
    /// <summary>
    /// Cheap reachability probe used by /healthz/ready. Returns true if the AI
    /// service responds 2xx within a short timeout. Never throws.
    /// </summary>
    public async Task<bool> PingAsync(CancellationToken ct = default)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(3));
            var res = await http.GetAsync("/health", cts.Token);
            return res.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Internal helper: POST a JSON request and deserialize a JSON response.
    /// Returns <c>null</c> for *any* transport-level failure (timeout, DNS
    /// failure, connection refused, non-2xx, empty/invalid JSON body) so the
    /// caller can render a graceful fallback. We never want a misbehaving AI
    /// service to surface as a 500 to end users — they get a friendly
    /// "service unavailable" message and the loop continues.
    /// </summary>
    private async Task<TResponse?> PostJsonAsync<TRequest, TResponse>(
        string endpoint,
        TRequest request,
        CancellationToken ct)
        where TResponse : class
    {
        try
        {
            var res = await http.PostAsJsonAsync(endpoint, request, ct);
            if (!res.IsSuccessStatusCode)
            {
                var body = await SafeReadBodyAsync(res, ct);
                logger.LogWarning(
                    "AI service POST {Endpoint} returned {Status}. Body: {Body}",
                    endpoint, (int)res.StatusCode, body);
                return null;
            }
            return await res.Content.ReadFromJsonAsync<TResponse>(cancellationToken: ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // Caller-triggered cancellation (e.g. client disconnected) — re-throw
            // so the controller can short-circuit. Not our problem.
            throw;
        }
        catch (TaskCanceledException ex)
        {
            // HttpClient timeout surfaces as TaskCanceledException.
            logger.LogWarning(ex, "AI service POST {Endpoint} timed out after {Timeout}s.",
                endpoint, http.Timeout.TotalSeconds);
            return null;
        }
        catch (HttpRequestException ex)
        {
            // DNS failure, connection refused, TLS error, etc.
            logger.LogWarning(ex, "AI service POST {Endpoint} transport failure: {Message}",
                endpoint, ex.Message);
            return null;
        }
        catch (System.Text.Json.JsonException ex)
        {
            logger.LogWarning(ex, "AI service POST {Endpoint} returned malformed JSON.", endpoint);
            return null;
        }
        catch (Exception ex)
        {
            // Last-resort catch-all — we'd rather show a friendly fallback
            // than 500 the user. Anything truly unexpected still gets logged.
            logger.LogError(ex, "AI service POST {Endpoint} failed unexpectedly.", endpoint);
            return null;
        }
    }

    private static async Task<string> SafeReadBodyAsync(HttpResponseMessage res, CancellationToken ct)
    {
        try
        {
            var body = await res.Content.ReadAsStringAsync(ct);
            return body.Length > 500 ? body[..500] + "…" : body;
        }
        catch
        {
            return "<unreadable>";
        }
    }

    public Task<AiPredictResponse?> PredictAsync(AiPredictRequest request, CancellationToken ct = default) =>
        PostJsonAsync<AiPredictRequest, AiPredictResponse>("/predict", request, ct);

    public Task<AiSimulateResponse?> SimulateAsync(AiSimulateRequest request, CancellationToken ct = default) =>
        PostJsonAsync<AiSimulateRequest, AiSimulateResponse>("/simulate", request, ct);

    /// <summary>
    /// One step of the chat-copilot tool-calling loop. Sends the full conversation
    /// (system + user + assistant tool_calls + tool results) plus the available tool
    /// schemas. The Python service returns either a tool_call or the final answer.
    /// Returns <c>null</c> on any failure so the orchestrator can render the friendly
    /// "AI service is not reachable" reply instead of bubbling a 500 to the user.
    /// </summary>
    public Task<ChatStepResponseDto?> ChatStepAsync(ChatStepRequestDto request, CancellationToken ct = default) =>
        PostJsonAsync<ChatStepRequestDto, ChatStepResponseDto>("/chat-step", request, ct);

    /// <summary>
    /// Ask the AI service to generate a one-glance project health brief. The
    /// numeric health score is computed server-side by the AI service for
    /// determinism; the LLM only writes the narrative.
    /// </summary>
    public Task<AiProjectBriefResponse?> GenerateProjectBriefAsync(AiProjectBriefRequest request, CancellationToken ct = default) =>
        PostJsonAsync<AiProjectBriefRequest, AiProjectBriefResponse>("/project-brief", request, ct);

    /// <summary>
    /// Ask the AI service to write a short weekly recap across the active org's
    /// portfolio. Input is already aggregated; the LLM only narrates.
    /// </summary>
    public Task<AiWeeklyRecapResponse?> GenerateWeeklyRecapAsync(AiWeeklyRecapRequest request, CancellationToken ct = default) =>
        PostJsonAsync<AiWeeklyRecapRequest, AiWeeklyRecapResponse>("/weekly-recap", request, ct);

    /// <summary>
    /// Ask the AI service for a short list of scenarios worth simulating on a
    /// project, given its current state. The .NET side owns running the math.
    /// </summary>
    public Task<AiAutoSuggestResponse?> AutoSuggestScenariosAsync(AiAutoSuggestRequest request, CancellationToken ct = default) =>
        PostJsonAsync<AiAutoSuggestRequest, AiAutoSuggestResponse>("/auto-suggest", request, ct);
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
