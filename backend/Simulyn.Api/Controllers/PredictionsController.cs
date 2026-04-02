using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Dtos;
using Simulyn.Api.Models.Entities;
using Simulyn.Api.Services;

namespace Simulyn.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class PredictionsController(AppDbContext db, AiClientService ai, BillingService billing) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost("run")]
    public async Task<ActionResult<IEnumerable<PredictionResultDto>>> Run([FromBody] RunPredictionRequest req, CancellationToken ct)
    {
        if (!await billing.IsEntitledAsync(UserId, ct))
            return StatusCode(402, "Subscription required. Contact sales for an invoice plan.");

        if (req.TaskId is null && req.ProjectId is null)
            return BadRequest("Provide taskId or projectId.");

        List<ProjectTask> tasks;
        if (req.TaskId is not null)
        {
            var t = await db.Tasks
                .Include(x => x.Project)
                .FirstOrDefaultAsync(x => x.Id == req.TaskId, ct);
            if (t == null || t.Project.UserId != UserId) return NotFound();
            tasks = [t];
        }
        else
        {
            var project = await db.Projects
                .Include(p => p.Tasks)
                .FirstOrDefaultAsync(p => p.Id == req.ProjectId && p.UserId == UserId, ct);
            if (project == null) return NotFound();
            tasks = project.Tasks.ToList();
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var results = new List<PredictionResultDto>();

        foreach (var task in tasks)
        {
            var project = await db.Projects.AsNoTracking().FirstAsync(p => p.Id == task.ProjectId, ct);
            var aiReq = new AiPredictRequest(
                task.Id.ToString(),
                task.Name,
                task.StartDate.ToString("yyyy-MM-dd"),
                task.EndDate.ToString("yyyy-MM-dd"),
                task.Progress,
                project.StartDate.ToString("yyyy-MM-dd"),
                project.EndDate.ToString("yyyy-MM-dd"));

            AiPredictResponse? aiRes = null;
            try
            {
                aiRes = await ai.PredictAsync(aiReq, ct);
            }
            catch
            {
                /* fallback */
            }

            string risk;
            int delay;
            string summary;
            string recommendation;
            if (aiRes != null)
            {
                risk = aiRes.RiskLevel;
                delay = aiRes.DelayDays;
                summary = aiRes.Summary;
                recommendation = aiRes.Recommendation;
            }
            else
            {
                var local = RuleBasedPrediction.Evaluate(task.StartDate, task.EndDate, task.Progress, today);
                risk = local.RiskLevel;
                delay = local.DelayDays;
                summary = local.Summary;
                recommendation = local.Recommendation;
            }

            var row = new Prediction
            {
                Id = Guid.NewGuid(),
                TaskId = task.Id,
                RiskLevel = risk,
                DelayDays = delay,
                Summary = summary,
                Recommendation = recommendation,
                CreatedAt = DateTime.UtcNow
            };
            db.Predictions.Add(row);
            await db.SaveChangesAsync(ct);

            results.Add(new PredictionResultDto(row.Id, row.TaskId, row.RiskLevel, row.DelayDays, row.Summary, row.Recommendation, row.CreatedAt));
        }

        return Ok(results);
    }
}
