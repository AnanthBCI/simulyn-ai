namespace Simulyn.Api.Models.Entities;

/// <summary>
/// One row per LLM-backed API call we want to track for budget / analytics.
/// Kept deliberately small — estimated cost only, no prompt/response content.
/// </summary>
public class UsageEvent
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid? UserId { get; set; }

    /// <summary>"prediction" | "simulation" | "project_brief" | "weekly_recap" | "chat".</summary>
    public string Kind { get; set; } = string.Empty;

    /// <summary>"openai" | "anthropic" | "ollama" | "off".</summary>
    public string? Provider { get; set; }
    public string? Model { get; set; }

    /// <summary>Estimated cost in USD cents (integer — we never divide downstream).</summary>
    public int CostUsdMills { get; set; } // 1/1000 USD

    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
}

public static class UsageEventKinds
{
    public const string Prediction = "prediction";
    public const string Simulation = "simulation";
    public const string ProjectBrief = "project_brief";
    public const string WeeklyRecap = "weekly_recap";
    public const string Chat = "chat";
}
