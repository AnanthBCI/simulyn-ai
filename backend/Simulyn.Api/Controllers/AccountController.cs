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
[Route("api")]
public class AccountController(
    AppDbContext db,
    BillingService billing,
    OrganizationContext orgContext) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<MeDto>> Me(CancellationToken ct)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdStr, out var userId)) return Unauthorized();

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return Unauthorized();

        var membership = await orgContext.GetMembershipAsync(ct);
        if (membership == null)
        {
            return Ok(new MeDto(
                user.Id, user.Name, user.Email, user.IsPlatformAdmin,
                null, null, null,
                "Starter", "Inactive", null, false));
        }

        var (entitled, plan, status, expiresAt) = await billing.GetOrgBillingAsync(membership.OrganizationId, ct);
        return Ok(new MeDto(
            user.Id, user.Name, user.Email, user.IsPlatformAdmin,
            membership.OrganizationId, membership.Organization.Name, membership.Role,
            plan, status, expiresAt, entitled));
    }
}
