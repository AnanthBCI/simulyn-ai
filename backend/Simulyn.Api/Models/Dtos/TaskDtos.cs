namespace Simulyn.Api.Models.Dtos;

/// <summary>
/// One row in the project task list, with enough prediction context for the UI
/// to render the current risk/delay AND a "how did it change" delta pill.
/// <para>
/// The <c>Latest*</c> fields come from the most recent <c>Prediction</c>; the
/// <c>Previous*</c> fields come from the second-most-recent. Both are null for
/// newly-added tasks with no prediction history.
/// </para>
/// </summary>
public record TaskDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    DateOnly StartDate,
    DateOnly EndDate,
    int Progress,
    string Status,
    string? LatestRisk,
    int? LatestDelayDays,
    string? LatestSummary,
    string? LatestRecommendation,
    DateTime? LatestPredictionAt,
    string? PreviousRisk = null,
    int? PreviousDelayDays = null,
    DateTime? PreviousPredictionAt = null);

public record CreateTaskRequest(Guid ProjectId, string Name, DateOnly StartDate, DateOnly EndDate, int Progress, string? Status);
public record UpdateTaskRequest(string? Name, DateOnly? StartDate, DateOnly? EndDate, int? Progress, string? Status);
