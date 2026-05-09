using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Dtos;
using Simulyn.Api.Models.Entities;
using Simulyn.Api.Services;

namespace Simulyn.Api.Controllers;

/// <summary>
/// Chat copilot endpoint. Users send a natural-language message; the orchestrator
/// runs an LLM tool-calling loop to fetch real org data and returns a final reply
/// in the user's language. All data access is scoped to the user's active org.
/// </summary>
[ApiController]
[Authorize]
[Route("api/[controller]")]
[EnableRateLimiting("chat")]
public class ChatController(
    AppDbContext db,
    ChatOrchestrator orchestrator,
    OrganizationContext orgContext,
    AiEntitlement aiEntitlement) : ControllerBase
{
    private const int MaxMessageLength = 2000;

    [HttpPost]
    public async Task<ActionResult<ChatResponseDto>> Chat(
        [FromBody] ChatRequestDto req,
        CancellationToken ct)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Message))
            return BadRequest("Message is required.");
        if (req.Message.Length > MaxMessageLength)
            return BadRequest($"Message is too long (max {MaxMessageLength} characters).");

        var membership = await orgContext.GetMembershipAsync(ct);
        if (membership is null)
            return StatusCode(403, "No active organization. Join or create one to use the chat copilot.");

        // Gate: entitlement + daily budget cap. Returns 402 / 429 if not allowed.
        var guard = await aiEntitlement.GuardAsync(membership.OrganizationId, Response, ct);
        if (guard != null) return guard;

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        var userName = user?.Name ?? "User";

        var response = await orchestrator.RunAsync(
            req,
            membership.OrganizationId,
            userId,
            membership.Organization.Name,
            userName,
            ct);

        await aiEntitlement.RecordAsync(membership.OrganizationId, UsageEventKinds.Chat, UsageService.ChatCostMills, ct);
        return Ok(response);
    }
}
