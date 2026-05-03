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

        if (string.Equals(org.SubscriptionStatus, "Inactive", StringComparison.OrdinalIgnoreCase)) return false;
        if (string.Equals(org.SubscriptionStatus, "Suspended", StringComparison.OrdinalIgnoreCase)) return false;

        var status = org.SubscriptionStatus.Trim();

        if (string.Equals(status, "Trial", StringComparison.OrdinalIgnoreCase))
        {
            if (org.SubscriptionExpiresAt is not { } exp) return false;
            return DateTime.UtcNow <= exp;
        }

        if (string.Equals(status, "Active", StringComparison.OrdinalIgnoreCase))
        {
            if (org.SubscriptionExpiresAt is { } exp)
                return DateTime.UtcNow <= exp;
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
