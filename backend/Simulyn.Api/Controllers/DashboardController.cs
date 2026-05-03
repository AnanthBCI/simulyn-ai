using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Dtos;
using Simulyn.Api.Services;

namespace Simulyn.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class DashboardController(
    AppDbContext db,
    AiClientService ai,
    OrganizationContext orgContext) : ControllerBase
{
    /// <summary>
    /// Weekly-recap cache. The LLM call is the expensive part, so we keep the
    /// last result in memory per org for 12 hours. An in-process dictionary is
    /// fine for single-instance deployments (trial / pilot scale); swap to a
    /// distributed cache once we run more than one API replica.
    /// </summary>
    private static readonly ConcurrentDictionary<Guid, (WeeklyRecapDto Recap, DateTime GeneratedAt)> _recapCache = new();
    private static readonly TimeSpan RecapCacheWindow = TimeSpan.FromHours(12);

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> Summary(CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;

        var projectIds = await db.Projects
            .Where(p => p.OrganizationId == orgId)
            .Select(p => p.Id)
            .ToListAsync(ct);
        var total = projectIds.Count;

        var tasks = await db.Tasks
            .AsNoTracking()
            .Where(t => projectIds.Contains(t.ProjectId))
            .Include(t => t.Predictions)
            .ToListAsync(ct);

        var high = 0;
        var medium = 0;
        var low = 0;
        var unpredicted = 0;

        foreach (var t in tasks)
        {
            var last = t.Predictions.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
            if (last == null)
            {
                unpredicted++;
                continue;
            }
            switch (last.RiskLevel)
            {
                case "High":
                    high++;
                    break;
                case "Medium":
                    medium++;
                    break;
                case "Low":
                    low++;
                    break;
            }
        }

        var openAlerts = high + medium;
        return Ok(new DashboardSummaryDto(total, high, openAlerts, low, medium, unpredicted));
    }

    [HttpGet("alerts")]
    public async Task<ActionResult<IEnumerable<AlertDto>>> Alerts(CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;

        var projectIds = await db.Projects
            .Where(p => p.OrganizationId == orgId)
            .Select(p => p.Id)
            .ToListAsync(ct);
        var tasks = await db.Tasks
            .AsNoTracking()
            .Where(t => projectIds.Contains(t.ProjectId))
            .Include(t => t.Predictions)
            .Include(t => t.Project)
            .ToListAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var alerts = new List<AlertDto>();
        foreach (var t in tasks)
        {
            var last = t.Predictions.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
            if (last == null) continue;
            if (last.RiskLevel is not ("High" or "Medium")) continue;
            var type = last.RiskLevel == "High" ? "risk_high" : "risk_medium";
            var reason = string.IsNullOrWhiteSpace(last.Summary) ? "Risk detected" : last.Summary!;
            var msg = $"{t.Name}: {reason}";

            // Deterministic "Why?" signal — mirrors the AI service math.
            var totalDays = Math.Max(1, t.EndDate.DayNumber - t.StartDate.DayNumber);
            var elapsed = Math.Clamp(today.DayNumber - t.StartDate.DayNumber, 0, totalDays);
            var expected = (int)Math.Round(100.0 * elapsed / totalDays);
            var gap = expected - t.Progress;
            var why = $"Expected ~{expected}% by today, actual {t.Progress}% (gap {gap:+0;-0;0} pts).";

            alerts.Add(new AlertDto(
                type,
                msg,
                t.ProjectId,
                t.Id,
                last.RiskLevel,
                last.CreatedAt,
                TaskName: t.Name,
                ProjectName: t.Project?.Name,
                Reason: reason,
                Recommendation: last.Recommendation,
                DelayDays: last.DelayDays,
                WhySignal: why));
        }

        alerts = alerts.OrderByDescending(a => a.CreatedAt).Take(50).ToList();
        return Ok(alerts);
    }

    /// <summary>
    /// Returns the most actionable AI insights across the org's projects. Used
    /// by the dashboard "AI Insights" widget. Sorted by risk severity then by
    /// recency, with task + project context attached.
    /// </summary>
    [HttpGet("insights")]
    public async Task<ActionResult<IEnumerable<InsightDto>>> Insights(
        [FromQuery] int limit = 5,
        CancellationToken ct = default)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        if (limit < 1) limit = 1;
        if (limit > 25) limit = 25;

        var projectIds = await db.Projects
            .Where(p => p.OrganizationId == orgId)
            .Select(p => p.Id)
            .ToListAsync(ct);

        var tasks = await db.Tasks
            .AsNoTracking()
            .Where(t => projectIds.Contains(t.ProjectId))
            .Include(t => t.Predictions)
            .Include(t => t.Project)
            .ToListAsync(ct);

        var insights = new List<InsightDto>();
        foreach (var t in tasks)
        {
            var last = t.Predictions.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
            if (last == null) continue;
            // Only surface predictions that have a useful narrative.
            if (string.IsNullOrWhiteSpace(last.Summary) && string.IsNullOrWhiteSpace(last.Recommendation))
                continue;
            insights.Add(new InsightDto(
                t.Id,
                t.Name,
                t.ProjectId,
                t.Project?.Name ?? "",
                last.RiskLevel,
                last.DelayDays,
                last.Summary,
                last.Recommendation,
                last.CreatedAt));
        }

        // Risk priority: High > Medium > Low. Within each, most recent first.
        static int RiskRank(string r) => r switch { "High" => 0, "Medium" => 1, _ => 2 };

        var ordered = insights
            .OrderBy(i => RiskRank(i.RiskLevel))
            .ThenByDescending(i => i.CreatedAt)
            .Take(limit)
            .ToList();
        return Ok(ordered);
    }

    /// <summary>
    /// Daily history of risk counts for the active org over the last N days.
    /// Computed on the fly: for each day in the window we look at every task
    /// and find its latest prediction whose CreatedAt is on or before the end
    /// of that day, then bucket by risk level.
    ///
    /// We deliberately don't maintain a separate snapshot table — predictions
    /// are immutable and the dataset is small enough at trial/pilot scale that
    /// computing in-memory is fine. Add a daily snapshot job once orgs cross
    /// ~5k tasks.
    /// </summary>
    [HttpGet("risk-trend")]
    public async Task<ActionResult<IEnumerable<RiskTrendPointDto>>> RiskTrend(
        [FromQuery] int days = 30,
        CancellationToken ct = default)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        if (days < 1) days = 1;
        if (days > 90) days = 90;

        var projectIds = await db.Projects
            .Where(p => p.OrganizationId == orgId)
            .Select(p => p.Id)
            .ToListAsync(ct);

        var tasks = await db.Tasks
            .AsNoTracking()
            .Where(t => projectIds.Contains(t.ProjectId))
            .Include(t => t.Predictions)
            .ToListAsync(ct);

        var today = DateTime.UtcNow.Date;
        var points = new List<RiskTrendPointDto>(days);

        for (var i = days - 1; i >= 0; i--)
        {
            var day = today.AddDays(-i);
            // Predictions made anywhere on `day` count toward that day's snapshot.
            var endOfDay = day.AddDays(1);

            var high = 0;
            var medium = 0;
            var low = 0;

            foreach (var t in tasks)
            {
                var last = t.Predictions
                    .Where(p => p.CreatedAt < endOfDay)
                    .OrderByDescending(p => p.CreatedAt)
                    .FirstOrDefault();
                if (last == null) continue;
                switch (last.RiskLevel)
                {
                    case "High": high++; break;
                    case "Medium": medium++; break;
                    case "Low": low++; break;
                }
            }

            points.Add(new RiskTrendPointDto(
                day.ToString("yyyy-MM-dd"),
                high,
                medium,
                low));
        }

        return Ok(points);
    }

    /// <summary>
    /// Short AI-generated weekly recap across all of the active org's projects.
    /// Cached in-memory for 12 hours per-org so the dashboard doesn't hammer
    /// the LLM on every refresh. Pass <c>?refresh=true</c> to force regen.
    /// </summary>
    [HttpGet("weekly-recap")]
    public async Task<ActionResult<WeeklyRecapDto>> WeeklyRecap(
        [FromQuery] bool refresh,
        CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;

        if (!refresh && _recapCache.TryGetValue(orgId!.Value, out var entry)
            && (DateTime.UtcNow - entry.GeneratedAt) < RecapCacheWindow)
        {
            return Ok(entry.Recap);
        }

        var org = await db.Organizations.AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == orgId, ct);

        var projects = await db.Projects
            .AsNoTracking()
            .Where(p => p.OrganizationId == orgId)
            .Include(p => p.Tasks).ThenInclude(t => t.Predictions)
            .ToListAsync(ct);

        var request = BuildRecapRequest(org?.Name ?? "Your organization", projects);

        AiWeeklyRecapResponse? aiRes = null;
        try { aiRes = await ai.GenerateWeeklyRecapAsync(request, ct); }
        catch { /* fall back to deterministic text */ }

        var recap = aiRes != null
            ? new WeeklyRecapDto(
                string.IsNullOrWhiteSpace(aiRes.Headline) ? FallbackRecapHeadline(request) : aiRes.Headline,
                aiRes.Bullets?.Count > 0 ? aiRes.Bullets : FallbackRecapBullets(request),
                DateTime.UtcNow,
                IsStale: false)
            : new WeeklyRecapDto(
                FallbackRecapHeadline(request),
                FallbackRecapBullets(request),
                DateTime.UtcNow,
                IsStale: true);

        _recapCache[orgId!.Value] = (recap, DateTime.UtcNow);
        return Ok(recap);
    }

    private static AiWeeklyRecapRequest BuildRecapRequest(
        string orgName,
        List<Simulyn.Api.Models.Entities.Project> projects)
    {
        var weekAgo = DateTime.UtcNow.AddDays(-7);
        int totalHigh = 0, totalMed = 0, totalLow = 0, totalUnpred = 0, predictionsThisWeek = 0;
        int highRiskNow = 0, highRiskWeekAgo = 0;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var perProject = new List<AiWeeklyRecapProject>();

        foreach (var p in projects)
        {
            int pHigh = 0, pMed = 0, pLow = 0, pUnpred = 0, pHighWeekAgo = 0;
            var progressSum = 0;
            var taskCount = p.Tasks.Count;

            foreach (var t in p.Tasks)
            {
                progressSum += t.Progress;
                var latest = t.Predictions.OrderByDescending(x => x.CreatedAt).FirstOrDefault();
                if (latest != null && latest.CreatedAt >= weekAgo) predictionsThisWeek++;

                if (latest == null) { pUnpred++; }
                else
                {
                    switch (latest.RiskLevel)
                    {
                        case "High": pHigh++; break;
                        case "Medium": pMed++; break;
                        case "Low": pLow++; break;
                        default: pUnpred++; break;
                    }
                }

                // High-risk count as of a week ago — use the latest prediction whose
                // CreatedAt was before the cutoff.
                var priorLatest = t.Predictions
                    .Where(x => x.CreatedAt < weekAgo)
                    .OrderByDescending(x => x.CreatedAt)
                    .FirstOrDefault();
                if (priorLatest?.RiskLevel == "High") pHighWeekAgo++;
            }

            totalHigh += pHigh; totalMed += pMed; totalLow += pLow; totalUnpred += pUnpred;
            highRiskNow += pHigh; highRiskWeekAgo += pHighWeekAgo;

            var totalDays = Math.Max(1, p.EndDate.DayNumber - p.StartDate.DayNumber);
            var elapsed = Math.Clamp(today.DayNumber - p.StartDate.DayNumber, 0, totalDays);
            var expected = (int)Math.Round(100.0 * elapsed / totalDays);
            var daysToFinish = p.EndDate.DayNumber - today.DayNumber;
            var avgProgress = taskCount > 0 ? progressSum / taskCount : 0;

            perProject.Add(new AiWeeklyRecapProject(
                p.Id.ToString(),
                p.Name,
                pHigh, pMed, pLow, pUnpred,
                taskCount,
                avgProgress,
                expected,
                daysToFinish,
                pHigh - pHighWeekAgo));
        }

        return new AiWeeklyRecapRequest(
            orgName,
            projects.Count,
            totalHigh, totalMed, totalLow, totalUnpred,
            predictionsThisWeek,
            highRiskNow - highRiskWeekAgo,
            perProject);
    }

    private static string FallbackRecapHeadline(AiWeeklyRecapRequest r)
    {
        if (r.ProjectCount == 0) return $"{r.OrganizationName}: nothing to recap yet.";
        if (r.TotalHighRisk == 0 && r.TotalMediumRisk == 0)
            return $"{r.ProjectCount} project(s), no open risks.";
        var direction = r.HighRiskDeltaWeek > 0 ? "up" : r.HighRiskDeltaWeek < 0 ? "down" : "flat";
        return $"{r.TotalHighRisk} high-risk task(s) across {r.ProjectCount} project(s) — {direction} vs last week.";
    }

    private static List<string> FallbackRecapBullets(AiWeeklyRecapRequest r)
    {
        if (r.ProjectCount == 0)
            return new() { "Create or import a project to start generating weekly recaps." };
        var worst = r.Projects.OrderByDescending(p => p.HighRiskCount).Take(3).ToList();
        var bullets = new List<string>();
        foreach (var p in worst)
        {
            if (p.HighRiskCount == 0) continue;
            bullets.Add(
                $"{p.ProjectName}: {p.HighRiskCount} high-risk, {p.AvgProgress}% progress vs {p.ExpectedProgress}% expected.");
        }
        if (bullets.Count == 0)
            bullets.Add($"Portfolio averages look healthy; {r.PredictionsThisWeek} prediction(s) ran this week.");
        return bullets;
    }
}
