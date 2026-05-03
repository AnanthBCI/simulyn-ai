using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Entities;

namespace Simulyn.Api.Services;

public class NotificationService(
    AppDbContext db,
    IEmailSender email,
    IOptions<EmailOptions> emailOptions,
    ILogger<NotificationService> logger)
{
    /// <summary>
    /// Fire off a high-risk alert email to every org member with the preference enabled.
    /// Dedupes per (org, taskId, UTC date) so a task re-running many times in a day doesn't spam.
    /// </summary>
    public async Task NotifyHighRiskAsync(
        Guid organizationId,
        Guid projectId,
        string projectName,
        Guid taskId,
        string taskName,
        int delayDays,
        string summary,
        CancellationToken ct = default)
    {
        var dedupKey = $"{taskId}:{DateTime.UtcNow:yyyy-MM-dd}";
        var already = await db.NotificationDeliveries
            .AnyAsync(n => n.OrganizationId == organizationId
                        && n.Kind == NotificationKinds.HighRisk
                        && n.DedupKey == dedupKey, ct);
        if (already) return;

        // Members with HighRiskAlerts enabled (default on for missing prefs row).
        var members = await db.OrganizationMembers
            .Where(m => m.OrganizationId == organizationId)
            .Join(db.Users, m => m.UserId, u => u.Id, (m, u) => new { m.UserId, u.Email })
            .ToListAsync(ct);
        if (members.Count == 0) return;

        var prefs = await db.NotificationPreferences
            .Where(p => p.OrganizationId == organizationId)
            .ToDictionaryAsync(p => p.UserId, ct);

        var appUrl = emailOptions.Value.AppUrl;
        var dedupInserted = false;
        foreach (var m in members)
        {
            var enabled = !prefs.TryGetValue(m.UserId, out var pref) || pref.HighRiskAlerts;
            if (!enabled) continue;
            try
            {
                await email.SendAsync(
                    EmailTemplates.HighRiskAlert(m.Email, appUrl, projectName, taskName, delayDays, projectId.ToString(), summary),
                    ct);

                if (!dedupInserted)
                {
                    db.NotificationDeliveries.Add(new NotificationDelivery
                    {
                        Id = Guid.NewGuid(),
                        OrganizationId = organizationId,
                        UserId = m.UserId,
                        Kind = NotificationKinds.HighRisk,
                        Email = m.Email,
                        DedupKey = dedupKey,
                        SentAt = DateTime.UtcNow,
                    });
                    dedupInserted = true;
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to send high-risk alert to {Email} for task {TaskId}", m.Email, taskId);
            }
        }
        if (dedupInserted) await db.SaveChangesAsync(ct);
    }
}
