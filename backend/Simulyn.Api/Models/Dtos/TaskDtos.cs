namespace Simulyn.Api.Models.Dtos;

public record TaskDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    DateOnly StartDate,
    DateOnly EndDate,
    int Progress,
    string Status,
    string? LatestRisk,
    int? LatestDelayDays);

public record CreateTaskRequest(Guid ProjectId, string Name, DateOnly StartDate, DateOnly EndDate, int Progress, string? Status);
public record UpdateTaskRequest(string? Name, DateOnly? StartDate, DateOnly? EndDate, int? Progress, string? Status);
