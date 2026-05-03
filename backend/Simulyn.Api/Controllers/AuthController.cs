using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Dtos;
using Simulyn.Api.Models.Entities;
using Simulyn.Api.Services;

namespace Simulyn.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("auth")]
public class AuthController(
    AppDbContext db,
    JwtService jwt,
    IConfiguration config,
    EmailTokenService tokens,
    IEmailSender email,
    IOptions<EmailOptions> emailOptions) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest("Email and password required.");
        if (await db.Users.AnyAsync(u => u.Email.ToLower() == req.Email.ToLower(), ct))
            return Conflict("Email already registered.");

        // Invite flow: if a token is provided, we consume it BEFORE creating the user
        // so we can reuse the email/role/org it was issued for.
        EmailToken? inviteToken = null;
        if (!string.IsNullOrWhiteSpace(req.InviteToken))
        {
            inviteToken = await tokens.ConsumeAsync(EmailTokenPurpose.OrgInvite, req.InviteToken!, ct);
            if (inviteToken == null)
                return BadRequest("Invite token is invalid or has expired.");
            if (!string.Equals(inviteToken.Email, req.Email.Trim().ToLowerInvariant(), StringComparison.OrdinalIgnoreCase))
                return BadRequest("This invite was issued to a different email address.");
        }

        var adminEmails = (config["PlatformAdminEmails"] ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.ToLowerInvariant())
            .ToHashSet();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = req.Name.Trim(),
            Email = req.Email.Trim().ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            CreatedAt = DateTime.UtcNow,
        };
        user.IsPlatformAdmin = adminEmails.Contains(user.Email);

        var personalOrg = new Organization
        {
            Id = Guid.NewGuid(),
            Name = $"{user.Name}'s workspace",
            CreatedAt = DateTime.UtcNow,
            Plan = "Starter",
            SubscriptionStatus = "Trial",
            SubscriptionActivatedAt = DateTime.UtcNow,
            SubscriptionExpiresAt = DateTime.UtcNow.AddDays(30),
        };
        var personalMembership = new OrganizationMember
        {
            OrganizationId = personalOrg.Id,
            UserId = user.Id,
            Role = OrgRoles.Owner,
            CreatedAt = DateTime.UtcNow,
        };

        db.Users.Add(user);
        db.Organizations.Add(personalOrg);
        db.OrganizationMembers.Add(personalMembership);

        // Invite fulfilment: add the new user to the inviting org.
        if (inviteToken is { OrganizationId: { } orgId, Role: { } role })
        {
            var org = await db.Organizations.FirstOrDefaultAsync(o => o.Id == orgId, ct);
            if (org != null)
            {
                db.OrganizationMembers.Add(new OrganizationMember
                {
                    OrganizationId = orgId,
                    UserId = user.Id,
                    Role = OrgRoles.IsValid(role) ? role : OrgRoles.Member,
                    CreatedAt = DateTime.UtcNow,
                });
            }
        }

        await db.SaveChangesAsync(ct);

        var token = jwt.CreateToken(user.Id, user.Email, user.Name, user.IsPlatformAdmin);
        return Ok(new AuthResponse(token, user.Id, user.Name, user.Email));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email.ToLowerInvariant(), ct);
        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized("Invalid credentials.");

        var token = jwt.CreateToken(user.Id, user.Email, user.Name, user.IsPlatformAdmin);
        return Ok(new AuthResponse(token, user.Id, user.Name, user.Email));
    }

    /// <summary>
    /// Issue a password-reset email. Always returns 200 regardless of whether
    /// the email exists — prevents email enumeration.
    /// </summary>
    [HttpPost("request-password-reset")]
    [AllowAnonymous]
    public async Task<IActionResult> RequestPasswordReset([FromBody] RequestPasswordResetRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Email))
            return Ok(new { status = "ok" });

        var normalised = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == normalised, ct);
        if (user != null)
        {
            var record = new EmailToken
            {
                Purpose = EmailTokenPurpose.PasswordReset,
                Email = normalised,
                UserId = user.Id,
                ExpiresAt = DateTime.UtcNow.Add(EmailTokenService.PasswordResetTtl),
            };
            var plaintext = await tokens.IssueAsync(record, ct);
            await email.SendAsync(EmailTemplates.PasswordReset(normalised, emailOptions.Value.AppUrl, plaintext), ct);
        }
        return Ok(new { status = "ok" });
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Token) || string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 8)
            return BadRequest("Invalid token or password too short (min 8 chars).");
        var record = await tokens.ConsumeAsync(EmailTokenPurpose.PasswordReset, req.Token, ct);
        if (record == null || record.UserId == null)
            return BadRequest("Token is invalid or has expired.");
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == record.UserId.Value, ct);
        if (user == null) return BadRequest("Account no longer exists.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);
        await db.SaveChangesAsync(ct);
        return Ok(new { status = "ok" });
    }

    /// <summary>Preview an invite token before using it (shows org name + role on the register page).</summary>
    [HttpGet("invite-preview")]
    [AllowAnonymous]
    public async Task<ActionResult<InvitePreviewResponse>> InvitePreview([FromQuery] string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token)) return BadRequest("Token required.");
        // Read-only peek: find token whose hash matches but don't consume it.
        var now = DateTime.UtcNow;
        var candidates = await db.EmailTokens
            .Where(t => t.Purpose == EmailTokenPurpose.OrgInvite && t.ConsumedAt == null && t.ExpiresAt > now)
            .OrderByDescending(t => t.CreatedAt)
            .Take(50)
            .ToListAsync(ct);
        var match = candidates.FirstOrDefault(c => BCrypt.Net.BCrypt.Verify(token, c.TokenHash));
        if (match == null || match.OrganizationId == null) return NotFound("Invite not found or expired.");
        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Id == match.OrganizationId.Value, ct);
        if (org == null) return NotFound("Organization no longer exists.");
        return Ok(new InvitePreviewResponse(match.Email, org.Name, match.Role ?? OrgRoles.Member, match.ExpiresAt));
    }
}
