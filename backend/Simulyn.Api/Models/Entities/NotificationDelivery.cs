namespace Simulyn.Api.Models.Entities;

/// <summary>
/// Audit + dedup row for every email we actually sent. Lets us answer
/// "did we already email this user about this task this week?" without
/// scanning email provider logs.
/// </summary>
public class NotificationDelivery
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid? UserId { get; set; }

    /// <summary>"high_risk" | "weekly_recap" | "invite" | "password_reset".</summary>
    public string Kind { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Deduplication key — format depends on <see cref="Kind"/>:
    /// - high_risk: "{taskId}:{isoDate}"
    /// - weekly_recap: "{isoMonday}"
    /// - invite / password_reset: "{tokenId}"
    /// </summary>
    public string? DedupKey { get; set; }

    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}

public static class NotificationKinds
{
    public const string HighRisk = "high_risk";
    public const string WeeklyRecap = "weekly_recap";
    public const string Invite = "invite";
    public const string PasswordReset = "password_reset";
}
