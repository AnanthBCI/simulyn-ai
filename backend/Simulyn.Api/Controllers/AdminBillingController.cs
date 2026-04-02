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
public class AdminBillingController(AppDbContext db, BillingService billing) : ControllerBase
{
    private bool IsPlatformAdmin() => BillingService.IsPlatformAdminClaim(User.FindFirstValue(ClaimTypes.Role));

    [HttpGet("users")]
    public async Task<ActionResult<IEnumerable<AdminUserDto>>> Users(CancellationToken ct)
    {
        if (!IsPlatformAdmin()) return Forbid();

        var users = await db.Users.AsNoTracking().ToListAsync(ct);
        var list = new List<AdminUserDto>();
        foreach (var u in users)
        {
            var entitled = await billing.IsEntitledAsync(u.Id, ct);
            list.Add(new AdminUserDto(
                u.Id,
                u.Name,
                u.Email,
                u.Plan,
                u.SubscriptionStatus,
                u.SubscriptionExpiresAt,
                entitled));
        }

        return Ok(list.OrderBy(x => x.Email));
    }

    [HttpPost("users/{userId:guid}/subscription")]
    public async Task<IActionResult> UpdateSubscription(
        Guid userId,
        [FromBody] SubscriptionUpdateRequest req,
        CancellationToken ct)
    {
        if (!IsPlatformAdmin()) return Forbid();

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return NotFound();

        user.Plan = string.IsNullOrWhiteSpace(req.Plan) ? user.Plan : req.Plan.Trim();
        user.SubscriptionStatus = string.IsNullOrWhiteSpace(req.SubscriptionStatus) ? user.SubscriptionStatus : req.SubscriptionStatus.Trim();
        user.SubscriptionExpiresAt = req.SubscriptionExpiresAt;
        user.BillingNotes = string.IsNullOrWhiteSpace(req.BillingNotes) ? user.BillingNotes : req.BillingNotes;

        if (user.SubscriptionActivatedAt == null && !string.Equals(user.SubscriptionStatus, "Inactive", StringComparison.OrdinalIgnoreCase))
            user.SubscriptionActivatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}

