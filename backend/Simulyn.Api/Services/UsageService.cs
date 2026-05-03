using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Entities;

namespace Simulyn.Api.Services;

public class UsageService(AppDbContext db, ILogger<UsageService> logger)
{
    // Per-call cost estimates in mills (1/1000 USD). Ballpark numbers for
    // gpt-4o-mini @ ~350 output tokens and haiku @ similar — good enough for
    // a budget guardrail, not for financial reporting.
    public const int PredictionCostMills = 3;      // ~$0.003 / task prediction
    public const int SimulationCostMills = 5;      // ~$0.005 / scenario
    public const int ProjectBriefCostMills = 4;    // ~$0.004
    public const int WeeklyRecapCostMills = 6;     // ~$0.006
    public const int ChatCostMills = 8;            // up to 6 tool-calls + final answer

    public async Task RecordAsync(Guid orgId, Guid? userId, string kind, int costMills, string? provider = null, string? model = null, CancellationToken ct = default)
    {
        db.UsageEvents.Add(new UsageEvent
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            UserId = userId,
            Kind = kind,
            Provider = provider,
            Model = model,
            CostUsdMills = costMills,
            OccurredAt = DateTime.UtcNow,
        });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to record usage event {Kind} for org {OrgId}", kind, orgId);
        }
    }

    /// <summary>Sum of cost-in-mills for the given org since UTC midnight.</summary>
    public async Task<int> GetTodayMillsAsync(Guid orgId, CancellationToken ct = default)
    {
        var since = DateTime.UtcNow.Date;
        return await db.UsageEvents
            .Where(u => u.OrganizationId == orgId && u.OccurredAt >= since)
            .SumAsync(u => (int?)u.CostUsdMills, ct) ?? 0;
    }
}
