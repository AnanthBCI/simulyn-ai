namespace Simulyn.Api.Models.Entities;

/// <summary>
/// Per-user-per-org email notification settings. A missing row = all defaults on.
/// </summary>
public class NotificationPreference
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid OrganizationId { get; set; }
    public Organization Organization { get; set; } = null!;

    /// <summary>Email when a task crosses Low/Medium → High.</summary>
    public bool HighRiskAlerts { get; set; } = true;

    /// <summary>Monday 06:00 org-local weekly PDF recap.</summary>
    public bool WeeklyRecap { get; set; } = true;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
