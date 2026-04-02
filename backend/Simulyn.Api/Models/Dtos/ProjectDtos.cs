namespace Simulyn.Api.Models.Dtos;

public record ProjectDto(
    Guid Id,
    string Name,
    DateOnly StartDate,
    DateOnly EndDate,
    string Status,
    int TaskCount,
    int HighRiskTaskCount);

public record CreateProjectRequest(string Name, DateOnly StartDate, DateOnly EndDate, string? Status);
