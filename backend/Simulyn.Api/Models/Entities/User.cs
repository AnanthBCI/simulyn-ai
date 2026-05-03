namespace Simulyn.Api.Models.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    /// <summary>Person-level capability — bypasses tenant checks for the platform-wide
    /// admin endpoints. Independent of any per-organization role.</summary>
    public bool IsPlatformAdmin { get; set; }

    public ICollection<OrganizationMember> Memberships { get; set; } = new List<OrganizationMember>();
}
