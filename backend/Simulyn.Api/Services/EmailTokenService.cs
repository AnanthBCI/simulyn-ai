using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Entities;

namespace Simulyn.Api.Services;

public class EmailTokenService(AppDbContext db)
{
    public static readonly TimeSpan PasswordResetTtl = TimeSpan.FromHours(1);
    public static readonly TimeSpan OrgInviteTtl = TimeSpan.FromDays(7);

    /// <summary>Returns the plaintext token to put in the email, and persists only the hash.</summary>
    public async Task<string> IssueAsync(EmailToken record, CancellationToken ct = default)
    {
        var plaintext = GenerateToken();
        record.Id = record.Id == Guid.Empty ? Guid.NewGuid() : record.Id;
        record.TokenHash = BCrypt.Net.BCrypt.HashPassword(plaintext, workFactor: 10);
        record.CreatedAt = DateTime.UtcNow;
        db.EmailTokens.Add(record);
        await db.SaveChangesAsync(ct);
        return plaintext;
    }

    /// <summary>Finds an unconsumed, unexpired token for the given purpose whose hash matches.</summary>
    public async Task<EmailToken?> ConsumeAsync(string purpose, string plaintext, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(plaintext)) return null;
        var now = DateTime.UtcNow;
        // We can't search by hash directly (BCrypt hashes differ even for the same input);
        // narrow by purpose + still-valid, then verify each. Cheap at our scale.
        var candidates = await db.EmailTokens
            .Where(t => t.Purpose == purpose && t.ConsumedAt == null && t.ExpiresAt > now)
            .OrderByDescending(t => t.CreatedAt)
            .Take(50)
            .ToListAsync(ct);
        foreach (var c in candidates)
        {
            if (BCrypt.Net.BCrypt.Verify(plaintext, c.TokenHash))
            {
                c.ConsumedAt = now;
                await db.SaveChangesAsync(ct);
                return c;
            }
        }
        return null;
    }

    private static string GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        // URL-safe base64 (no padding) — 43 chars, roughly 256 bits of entropy.
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
