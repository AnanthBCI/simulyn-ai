using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Simulyn.Api.Models.Dtos;
using Simulyn.Api.Services;

namespace Simulyn.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public class AccountController(BillingService billing) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<MeDto>> Me(CancellationToken ct)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var (isEntitled, plan, status, expiresAt) = await billing.GetMeAsync(userId, ct);
        return Ok(new MeDto(userId, plan, status, expiresAt, isEntitled));
    }
}

