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
[Route("api")]
public class SimulationsController(AppDbContext db, AiClientService ai, BillingService billing) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost("simulation")]
    public async Task<ActionResult<SimulationResultDto>> Run([FromBody] RunSimulationRequest req, CancellationToken ct)
    {
        if (!await billing.IsEntitledAsync(UserId, ct))
            return StatusCode(402, "Subscription required. Contact sales for an invoice plan.");

        var project = await db.Projects
            .Include(p => p.Tasks)
            .FirstOrDefaultAsync(p => p.Id == req.ProjectId && p.UserId == UserId, ct);
        if (project == null) return NotFound();

        var aiReq = new AiSimulateRequest(
            project.Id.ToString(),
            req.InputDelayDays,
            project.StartDate.ToString("yyyy-MM-dd"),
            project.EndDate.ToString("yyyy-MM-dd"),
            project.Tasks.Count);

        int predicted;
        string impact;
        try
        {
            var aiRes = await ai.SimulateAsync(aiReq, ct);
            if (aiRes != null)
            {
                predicted = aiRes.PredictedDelay;
                impact = aiRes.ImpactSummary;
            }
            else
            {
                var local = RuleBasedPrediction.SimulateProjectDelay(project.StartDate, project.EndDate, req.InputDelayDays, project.Tasks.Count);
                predicted = local.PredictedDelay;
                impact = local.ImpactSummary;
            }
        }
        catch
        {
            var local = RuleBasedPrediction.SimulateProjectDelay(project.StartDate, project.EndDate, req.InputDelayDays, project.Tasks.Count);
            predicted = local.PredictedDelay;
            impact = local.ImpactSummary;
        }

        var row = new Simulation
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            InputDelay = req.InputDelayDays,
            PredictedDelay = predicted,
            ImpactSummary = impact,
            CreatedAt = DateTime.UtcNow
        };
        db.Simulations.Add(row);
        await db.SaveChangesAsync(ct);

        return Ok(new SimulationResultDto(row.Id, row.ProjectId, row.InputDelay, row.PredictedDelay, row.ImpactSummary, row.CreatedAt));
    }
}
