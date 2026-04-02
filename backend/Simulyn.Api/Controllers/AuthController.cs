using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Dtos;
using Simulyn.Api.Models.Entities;
using Simulyn.Api.Services;

namespace Simulyn.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(AppDbContext db, JwtService jwt, IConfiguration config) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest("Email and password required.");
        if (await db.Users.AnyAsync(u => u.Email.ToLower() == req.Email.ToLower(), ct))
            return Conflict("Email already registered.");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = req.Name.Trim(),
            Email = req.Email.Trim().ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            CreatedAt = DateTime.UtcNow
        };

        var adminEmails = (config["PlatformAdminEmails"] ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.ToLowerInvariant())
            .ToHashSet();

        user.IsPlatformAdmin = adminEmails.Contains(user.Email);
        user.Plan = user.Plan ?? "Starter";
        user.SubscriptionStatus = string.IsNullOrWhiteSpace(user.SubscriptionStatus) ? "Trial" : user.SubscriptionStatus;
        user.SubscriptionActivatedAt ??= DateTime.UtcNow;
        user.SubscriptionExpiresAt ??= DateTime.UtcNow.AddDays(30);

        db.Users.Add(user);
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
}
