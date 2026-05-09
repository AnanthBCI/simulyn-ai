using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;

namespace Simulyn.Api.Services;

/// <summary>
/// Per-organization entitlement / billing checks. After multi-tenancy refactor:
/// billing lives on the Organization, not the User.
/// </summary>
public class BillingService(AppDbContext db)
{
    public async Task<bool> IsEntitledAsync(Guid organizationId, CancellationToken ct = default)
    {
        var org = await db.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Id == organizationId, ct);
        if (org == null) return false;
        return IsEntitled(org.SubscriptionStatus, org.SubscriptionExpiresAt);
    }

    /// <summary>
    /// Pure entitlement check — given subscription status + expiry, decide if the
    /// org can hit billable endpoints. Exposed so callers that already loaded the
    /// Organization (e.g. <c>OrganizationsController.Mine</c>) can avoid an extra
    /// DB roundtrip per org.
    /// </summary>
    public static bool IsEntitled(string subscriptionStatus, DateTime? expiresAt)
    {
        if (string.IsNullOrWhiteSpace(subscriptionStatus)) return false;
        if (string.Equals(subscriptionStatus, "Inactive", StringComparison.OrdinalIgnoreCase)) return false;
        if (string.Equals(subscriptionStatus, "Suspended", StringComparison.OrdinalIgnoreCase)) return false;

        var status = subscriptionStatus.Trim();
        if (string.Equals(status, "Trial", StringComparison.OrdinalIgnoreCase))
        {
            if (expiresAt is not { } exp) return false;
            return DateTime.UtcNow <= exp;
        }
        if (string.Equals(status, "Active", StringComparison.OrdinalIgnoreCase))
        {
            if (expiresAt is { } exp) return DateTime.UtcNow <= exp;
            return true;
        }
        return false;
    }

    public async Task<(bool IsEntitled, string Plan, string SubscriptionStatus, DateTime? ExpiresAt)> GetOrgBillingAsync(
        Guid organizationId,
        CancellationToken ct = default)
    {
        var org = await db.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Id == organizationId, ct);
        if (org == null) return (false, "Starter", "Inactive", null);

        return (
            await IsEntitledAsync(organizationId, ct),
            org.Plan,
            org.SubscriptionStatus,
            org.SubscriptionExpiresAt
        );
    }

    public static bool IsPlatformAdminClaim(string? roleClaim)
        => string.Equals(roleClaim, "platform_admin", StringComparison.OrdinalIgnoreCase);
}
