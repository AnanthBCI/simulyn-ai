namespace Simulyn.Api.Models.Entities;

/// <summary>
/// Single-use signed token for out-of-band email flows (password reset,
/// organization invites for users that don't have an account yet).
/// The token string sent in the email is the BCrypt hash-preimage — we only
/// store the hash, so leaking the DB doesn't hand over valid tokens.
/// </summary>
public class EmailToken
{
    public Guid Id { get; set; }

    /// <summary>BCrypt hash of the opaque token sent in the email.</summary>
    public string TokenHash { get; set; } = string.Empty;

    /// <summary>"PasswordReset" or "OrgInvite".</summary>
    public string Purpose { get; set; } = string.Empty;

    /// <summary>Email the token was issued for (lowercased).</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>Set for PasswordReset when the email already has an account.</summary>
    public Guid? UserId { get; set; }

    /// <summary>Set for OrgInvite — the org to join after register.</summary>
    public Guid? OrganizationId { get; set; }

    /// <summary>Set for OrgInvite — the role to grant on join.</summary>
    public string? Role { get; set; }

    /// <summary>Set for OrgInvite — the user that issued the invite (audit).</summary>
    public Guid? InvitedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? ConsumedAt { get; set; }
}

public static class EmailTokenPurpose
{
    public const string PasswordReset = "PasswordReset";
    public const string OrgInvite = "OrgInvite";
}
