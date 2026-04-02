using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Dtos;

namespace Simulyn.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class DashboardController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> Summary(CancellationToken ct)
    {
        var projectIds = await db.Projects.Where(p => p.UserId == UserId).Select(p => p.Id).ToListAsync(ct);
        var total = projectIds.Count;

        var tasks = await db.Tasks
            .AsNoTracking()
            .Where(t => projectIds.Contains(t.ProjectId))
            .Include(t => t.Predictions)
            .ToListAsync(ct);

        var highRisk = 0;
        var alertCount = 0;
        foreach (var t in tasks)
        {
            var last = t.Predictions.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
            if (last == null) continue;
            if (last.RiskLevel == "High") highRisk++;
            if (last.RiskLevel is "High" or "Medium") alertCount++;
        }

        return Ok(new DashboardSummaryDto(total, highRisk, alertCount));
    }

    [HttpGet("alerts")]
    public async Task<ActionResult<IEnumerable<AlertDto>>> Alerts(CancellationToken ct)
    {
        var projectIds = await db.Projects.Where(p => p.UserId == UserId).Select(p => p.Id).ToListAsync(ct);
        var tasks = await db.Tasks
            .AsNoTracking()
            .Where(t => projectIds.Contains(t.ProjectId))
            .Include(t => t.Predictions)
            .Include(t => t.Project)
            .ToListAsync(ct);

        var alerts = new List<AlertDto>();
        foreach (var t in tasks)
        {
            var last = t.Predictions.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
            if (last == null) continue;
            if (last.RiskLevel is not ("High" or "Medium")) continue;
            var type = last.RiskLevel == "High" ? "risk_high" : "risk_medium";
            var msg = $"{t.Name}: {last.Summary ?? "Risk detected"}";
            alerts.Add(new AlertDto(type, msg, t.ProjectId, t.Id, last.RiskLevel, last.CreatedAt));
        }

        alerts = alerts.OrderByDescending(a => a.CreatedAt).Take(50).ToList();
        return Ok(alerts);
    }
}
