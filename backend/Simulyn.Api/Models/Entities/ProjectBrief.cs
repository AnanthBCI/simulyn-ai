namespace Simulyn.Api.Models.Entities;

/// <summary>
/// Cached AI-generated narrative for a project: a short headline, a 2-3 sentence
/// body, and a 0-100 health score. One row per project (overwritten on refresh)
/// rather than appended like Predictions, because the brief is a snapshot view —
/// we only need "what does this project look like right now?"
///
/// Refreshed when a user clicks "Refresh" or when the cached brief is older
/// than 12 hours and someone opens the project page.
/// </summary>
public class ProjectBrief
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }

    /// <summary>One-line punchy summary, e.g. "On track but interior fitout slipping ~10 days".</summary>
    public string Headline { get; set; } = string.Empty;

    /// <summary>2-3 sentence narrative body explaining the current state.</summary>
    public string Body { get; set; } = string.Empty;

    /// <summary>0 (worst) to 100 (best). Composite of risk distribution + progress vs window.</summary>
    public int HealthScore { get; set; }

    /// <summary>JSON array of short tag strings (e.g. ["At risk","Behind schedule"]).</summary>
    public string ToneTags { get; set; } = "[]";

    public DateTime CreatedAt { get; set; }

    public Project Project { get; set; } = null!;
}
