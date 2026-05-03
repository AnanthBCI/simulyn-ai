using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Entities;

namespace Simulyn.Api.Services;

/// <summary>
/// Resolves the active organization for the current request.
///
/// Resolution order:
///   1. <c>X-Organization-Id</c> request header (preferred — lets users switch orgs without re-login).
///   2. The user's first membership (so single-org users don't have to think about it).
///
/// Validates membership; never returns an org the caller doesn't belong to.
/// </summary>
public class OrganizationContext(IHttpContextAccessor httpContextAccessor, AppDbContext db)
{
    public const string HeaderName = "X-Organization-Id";

    private bool _resolved;
    private OrganizationMember? _membership;

    private HttpContext Http => httpContextAccessor.HttpContext
        ?? throw new InvalidOperationException("OrganizationContext used outside of an HTTP request.");

    public Guid? CurrentUserId
    {
        get
        {
            var claim = Http.User.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? Http.User.FindFirstValue("sub");
            return Guid.TryParse(claim, out var id) ? id : null;
        }
    }

    public bool IsPlatformAdmin =>
        BillingService.IsPlatformAdminClaim(Http.User.FindFirstValue(ClaimTypes.Role));

    /// <summary>Resolves the active membership; returns null if the user has no orgs or
    /// has no membership in the org they asked for.</summary>
    public async Task<OrganizationMember?> GetMembershipAsync(CancellationToken ct = default)
    {
        if (_resolved) return _membership;
        _resolved = true;

        var userId = CurrentUserId;
        if (userId is null) return _membership = null;

        // 1) Honour the header if present and the caller is a member.
        if (Http.Request.Headers.TryGetValue(HeaderName, out var headerValue) &&
            Guid.TryParse(headerValue.ToString(), out var requestedOrgId))
        {
            _membership = await db.OrganizationMembers
                .Include(m => m.Organization)
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.UserId == userId.Value && m.OrganizationId == requestedOrgId, ct);
            if (_membership is not null) return _membership;
        }

        // 2) Fall back to first membership (creation order).
        _membership = await db.OrganizationMembers
            .Include(m => m.Organization)
            .AsNoTracking()
            .Where(m => m.UserId == userId.Value)
            .OrderBy(m => m.CreatedAt)
            .FirstOrDefaultAsync(ct);

        return _membership;
    }

    public async Task<Guid?> GetOrganizationIdAsync(CancellationToken ct = default)
        => (await GetMembershipAsync(ct))?.OrganizationId;

    public async Task<string?> GetRoleAsync(CancellationToken ct = default)
        => (await GetMembershipAsync(ct))?.Role;

    /// <summary>Convenience: returns 403 if the caller is not entitled to write in the active org.</summary>
    public async Task<ActionResult?> RequireRoleAsync(string minimumRole, CancellationToken ct = default)
    {
        var role = await GetRoleAsync(ct);
        if (role is null) return new ObjectResult("Not a member of any organization.") { StatusCode = 403 };
        if (!OrgRoles.AtLeast(role, minimumRole))
            return new ObjectResult($"Role '{role}' does not allow this action (need {minimumRole} or higher).") { StatusCode = 403 };
        return null;
    }

    /// <summary>Convenience: returns 403 if the caller is not in any org. Returns the org id otherwise.</summary>
    public async Task<(Guid? OrgId, ActionResult? Forbidden)> RequireOrgAsync(CancellationToken ct = default)
    {
        var orgId = await GetOrganizationIdAsync(ct);
        if (orgId is null)
            return (null, new ObjectResult("No active organization. Set the X-Organization-Id header or join an org.") { StatusCode = 403 });
        return (orgId, null);
    }
}
