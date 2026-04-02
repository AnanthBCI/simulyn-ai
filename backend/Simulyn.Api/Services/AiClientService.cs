using System.Net.Http.Json;
using System.Text.Json.Serialization;

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

public record AiSimulateRequest(
    [property: JsonPropertyName("project_id")] string ProjectId,
    [property: JsonPropertyName("input_delay_days")] int InputDelayDays,
    [property: JsonPropertyName("project_start")] string ProjectStart,
    [property: JsonPropertyName("project_end")] string ProjectEnd,
    [property: JsonPropertyName("task_count")] int TaskCount);

public record AiSimulateResponse(
    [property: JsonPropertyName("predicted_delay")] int PredictedDelay,
    [property: JsonPropertyName("impact_summary")] string ImpactSummary);
