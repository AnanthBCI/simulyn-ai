using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Dtos;
using Simulyn.Api.Services;

namespace Simulyn.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/admin")]
public class AdminBillingController(AppDbContext db) : ControllerBase
{
    private bool IsPlatformAdmin() => BillingService.IsPlatformAdminClaim(User.FindFirstValue(ClaimTypes.Role));

    [HttpGet("organizations")]
    public async Task<ActionResult<IEnumerable<AdminOrgDto>>> Organizations(CancellationToken ct)
    {
        if (!IsPlatformAdmin()) return Forbid();

        var orgs = await db.Organizations.AsNoTracking().ToListAsync(ct);
        var memberCounts = await db.OrganizationMembers
            .GroupBy(m => m.OrganizationId)
            .Select(g => new { OrgId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.OrgId, x => x.Count, ct);
        var projectCounts = await db.Projects
            .GroupBy(p => p.OrganizationId)
            .Select(g => new { OrgId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.OrgId, x => x.Count, ct);

        // Compute entitlement in-memory — no per-org DB roundtrip needed since
        // we already loaded SubscriptionStatus + SubscriptionExpiresAt.
        var list = orgs.Select(o => new AdminOrgDto(
            o.Id, o.Name, o.Plan, o.SubscriptionStatus, o.SubscriptionExpiresAt,
            BillingService.IsEntitled(o.SubscriptionStatus, o.SubscriptionExpiresAt),
            memberCounts.TryGetValue(o.Id, out var m) ? m : 0,
            projectCounts.TryGetValue(o.Id, out var p) ? p : 0)).ToList();
        return Ok(list.OrderBy(x => x.Name));
    }

    [HttpPost("organizations/{organizationId:guid}/subscription")]
    public async Task<IActionResult> UpdateSubscription(
        Guid organizationId,
        [FromBody] SubscriptionUpdateRequest req,
        CancellationToken ct)
    {
        if (!IsPlatformAdmin()) return Forbid();

        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Id == organizationId, ct);
        if (org == null) return NotFound();

        org.Plan = string.IsNullOrWhiteSpace(req.Plan) ? org.Plan : req.Plan.Trim();
        org.SubscriptionStatus = string.IsNullOrWhiteSpace(req.SubscriptionStatus) ? org.SubscriptionStatus : req.SubscriptionStatus.Trim();
        org.SubscriptionExpiresAt = req.SubscriptionExpiresAt;
        org.BillingNotes = string.IsNullOrWhiteSpace(req.BillingNotes) ? org.BillingNotes : req.BillingNotes;

        if (org.SubscriptionActivatedAt == null && !string.Equals(org.SubscriptionStatus, "Inactive", StringComparison.OrdinalIgnoreCase))
            org.SubscriptionActivatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
