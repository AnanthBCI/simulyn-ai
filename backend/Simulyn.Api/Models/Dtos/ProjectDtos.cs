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
public record UpdateProjectRequest(string? Name, DateOnly? StartDate, DateOnly? EndDate, string? Status);

/// <summary>
/// One-glance project health brief surfaced at the top of the project page.
/// Returned by GET /api/projects/{id}/brief; refreshed via ?refresh=true or
/// when the cached row is older than 12 hours.
/// </summary>
public record ProjectBriefDto(
    Guid ProjectId,
    string Headline,
    string Body,
    int HealthScore,
    IReadOnlyList<string> ToneTags,
    DateTime CreatedAt,
    bool IsStale);
