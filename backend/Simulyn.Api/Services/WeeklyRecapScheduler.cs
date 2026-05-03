using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Entities;

namespace Simulyn.Api.Services;

/// <summary>
/// Wakes every 10 minutes, checks if any org has crossed its Monday 06:00 UTC
/// threshold since the last send, and dispatches weekly recap emails with the
/// PDF attached (well — linked; see TODO).
///
/// TODO: orgs don't currently have a configured timezone, so we use Monday
/// 06:00 UTC for everyone. Add <c>Organization.Timezone</c> and honour it
/// when the "customer success" phase 2 lands.
/// </summary>
public class WeeklyRecapScheduler(
    IServiceScopeFactory scopes,
    ILogger<WeeklyRecapScheduler> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(10);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("WeeklyRecapScheduler started");
        // Stagger first tick a bit so we don't hammer the DB on cold start.
        try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); } catch { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await TickAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "WeeklyRecapScheduler tick failed");
            }
            try { await Task.Delay(PollInterval, stoppingToken); } catch { break; }
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        // Only consider sending once we're inside the Monday 06:00-08:00 UTC window —
        // cheap guard, keeps this loop from scanning the DB 6x/hr all week.
        if (now.DayOfWeek != DayOfWeek.Monday) return;
        if (now.Hour < 6 || now.Hour >= 8) return;

        var thisMondayKey = now.ToString("yyyy-MM-dd");

        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var email = scope.ServiceProvider.GetRequiredService<IEmailSender>();
        var emailOptions = scope.ServiceProvider.GetRequiredService<IOptions<EmailOptions>>();
        var ai = scope.ServiceProvider.GetRequiredService<AiClientService>();

        var orgs = await db.Organizations
            .Where(o => o.SubscriptionStatus == "Active" || o.SubscriptionStatus == "Trial")
            .Select(o => o.Id)
            .ToListAsync(ct);

        foreach (var orgId in orgs)
        {
            var already = await db.NotificationDeliveries
                .AnyAsync(n => n.OrganizationId == orgId
                            && n.Kind == NotificationKinds.WeeklyRecap
                            && n.DedupKey == thisMondayKey, ct);
            if (already) continue;

            try
            {
                await DispatchOneAsync(db, email, emailOptions.Value.AppUrl, ai, orgId, thisMondayKey, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Weekly recap dispatch failed for org {OrgId}", orgId);
            }
        }
    }

    private async Task DispatchOneAsync(
        AppDbContext db,
        IEmailSender email,
        string appUrl,
        AiClientService ai,
        Guid orgId,
        string dedupKey,
        CancellationToken ct)
    {
        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Id == orgId, ct);
        if (org == null) return;

        var members = await db.OrganizationMembers
            .Where(m => m.OrganizationId == orgId)
            .Join(db.Users, m => m.UserId, u => u.Id, (m, u) => new { m.UserId, u.Email })
            .ToListAsync(ct);
        var prefs = await db.NotificationPreferences
            .Where(p => p.OrganizationId == orgId)
            .ToDictionaryAsync(p => p.UserId, ct);
        var recipients = members
            .Where(m => !prefs.TryGetValue(m.UserId, out var p) || p.WeeklyRecap)
            .ToList();
        if (recipients.Count == 0) return;

        // Compose the AI recap (deterministic fallback if AI is down — DashboardController
        // does the same dance, but the scheduler can't go through a controller).
        var projects = await db.Projects
            .Where(p => p.OrganizationId == orgId)
            .Select(p => new { p.Id, p.Name, Tasks = p.Tasks.Count, High = p.Tasks.Count(t => t.Predictions.OrderByDescending(pp => pp.CreatedAt).FirstOrDefault()!.RiskLevel == "High") })
            .ToListAsync(ct);
        var headline = $"{org.Name} — {projects.Sum(p => p.High)} high-risk tasks across {projects.Count} projects";
        var bullets = projects
            .OrderByDescending(p => p.High)
            .Take(5)
            .Select(p => $"{p.Name}: {p.High} high-risk, {p.Tasks} total tasks")
            .ToList();
        if (bullets.Count == 0)
            bullets.Add("No projects yet — create one to start seeing weekly risk trends.");

        try
        {
            var aiProjects = projects.Select(p => new AiWeeklyRecapProject(
                ProjectId: p.Id.ToString(),
                ProjectName: p.Name,
                HighRiskCount: p.High,
                MediumRiskCount: 0,
                LowRiskCount: 0,
                UnpredictedCount: 0,
                TaskCount: p.Tasks,
                AvgProgress: 0,
                ExpectedProgress: 0,
                DaysToFinish: 0,
                HighRiskDelta: 0)).ToList();
            var aiRecap = await ai.GenerateWeeklyRecapAsync(new AiWeeklyRecapRequest(
                OrganizationName: org.Name,
                ProjectCount: projects.Count,
                TotalHighRisk: projects.Sum(p => p.High),
                TotalMediumRisk: 0,
                TotalLowRisk: 0,
                TotalUnpredicted: 0,
                PredictionsThisWeek: 0,
                HighRiskDeltaWeek: 0,
                Projects: aiProjects), ct);
            if (aiRecap != null)
            {
                headline = aiRecap.Headline;
                bullets = aiRecap.Bullets.ToList();
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Weekly recap: AI narrative unavailable, using deterministic text");
        }

        var emailMsg = EmailTemplates.WeeklyRecap(recipients[0].Email, appUrl, org.Name, headline, bullets);
        foreach (var r in recipients)
        {
            var personalised = emailMsg with { To = r.Email };
            await email.SendAsync(personalised, ct);
        }

        db.NotificationDeliveries.Add(new NotificationDelivery
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            UserId = null,
            Kind = NotificationKinds.WeeklyRecap,
            Email = recipients[0].Email,
            DedupKey = dedupKey,
            SentAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Weekly recap sent to {Count} members of org {OrgId}", recipients.Count, orgId);
    }
}
