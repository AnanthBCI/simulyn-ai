namespace Simulyn.Api.Models.Entities;

/// <summary>
/// Tenant. Projects, tasks, predictions, simulations and billing are all scoped
/// to an Organization. Users join organizations via <see cref="OrganizationMember"/>.
/// </summary>
public class Organization
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    // Per-tenant billing (moved off the User entity in the multi-tenancy refactor).
    public string Plan { get; set; } = "Starter";
    public string SubscriptionStatus { get; set; } = "Trial";  // Trial, Active, Suspended, Inactive
    public DateTime? SubscriptionActivatedAt { get; set; }
    public DateTime? SubscriptionExpiresAt { get; set; }
    public string? BillingNotes { get; set; }

    public ICollection<OrganizationMember> Members { get; set; } = new List<OrganizationMember>();
    public ICollection<Project> Projects { get; set; } = new List<Project>();
}
