namespace Simulyn.Api.Models.Entities;

/// <summary>Join row between User and Organization, with a role per (org, user) pair.</summary>
public class OrganizationMember
{
    public Guid OrganizationId { get; set; }
    public Guid UserId { get; set; }

    /// <summary>Owner | Admin | Member | Viewer. See <see cref="OrgRoles"/>.</summary>
    public string Role { get; set; } = OrgRoles.Member;

    public DateTime CreatedAt { get; set; }

    public Organization Organization { get; set; } = null!;
    public User User { get; set; } = null!;
}

public static class OrgRoles
{
    public const string Owner = "Owner";
    public const string Admin = "Admin";
    public const string Member = "Member";
    public const string Viewer = "Viewer";

    public static bool IsValid(string role) =>
        role is Owner or Admin or Member or Viewer;

    /// <summary>Numeric weight used for "at least this role" checks. Higher = more powerful.</summary>
    public static int Weight(string role) => role switch
    {
        Owner => 4,
        Admin => 3,
        Member => 2,
        Viewer => 1,
        _ => 0,
    };

    public static bool AtLeast(string role, string minimum) =>
        Weight(role) >= Weight(minimum);

    public static bool CanWrite(string role) => AtLeast(role, Member);
    public static bool CanManageMembers(string role) => AtLeast(role, Admin);
    public static bool IsOwner(string role) => string.Equals(role, Owner, StringComparison.OrdinalIgnoreCase);
}
