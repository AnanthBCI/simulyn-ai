namespace Simulyn.Api.Models.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    // For manual/invoice sales (no payment processor yet)
    public bool IsPlatformAdmin { get; set; }
    public string Plan { get; set; } = "Starter";
    public string SubscriptionStatus { get; set; } = "Trial"; // Trial, Active, Suspended, Inactive
    public DateTime? SubscriptionActivatedAt { get; set; }
    public DateTime? SubscriptionExpiresAt { get; set; }
    public string? BillingNotes { get; set; }

    public ICollection<Project> Projects { get; set; } = new List<Project>();
}
