using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;

namespace Simulyn.Api.Services;

public class BillingService(AppDbContext db)
{
    public async Task<bool> IsEntitledAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return false;

        if (string.Equals(user.SubscriptionStatus, "Inactive", StringComparison.OrdinalIgnoreCase)) return false;
        if (string.Equals(user.SubscriptionStatus, "Suspended", StringComparison.OrdinalIgnoreCase)) return false;

        var status = user.SubscriptionStatus.Trim();

        if (string.Equals(status, "Trial", StringComparison.OrdinalIgnoreCase))
        {
            // Trial must have an expiry date to be considered entitled.
            if (user.SubscriptionExpiresAt is not { } exp) return false;
            return DateTime.UtcNow <= exp;
        }

        if (string.Equals(status, "Active", StringComparison.OrdinalIgnoreCase))
        {
            // Active is considered entitled until explicitly expired/suspended.
            if (user.SubscriptionExpiresAt is { } exp)
                return DateTime.UtcNow <= exp;
            return true;
        }

        return false;
    }

    public async Task<(bool IsEntitled, string Plan, string SubscriptionStatus, DateTime? ExpiresAt)> GetMeAsync(
        Guid userId,
        CancellationToken ct = default)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return (false, "Starter", "Inactive", null);

        return (
            await IsEntitledAsync(userId, ct),
            user.Plan,
            user.SubscriptionStatus,
            user.SubscriptionExpiresAt
        );
    }

    public static bool IsPlatformAdminClaim(string? roleClaim)
        => string.Equals(roleClaim, "platform_admin", StringComparison.OrdinalIgnoreCase);
}

