using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Simulyn.Api.Models.Dtos;
using Simulyn.Api.Models.Entities;
using Simulyn.Api.Services;

namespace Simulyn.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
[EnableRateLimiting("predictions")]
public class PredictionsController(
    PredictionService predictions,
    BillingService billing,
    BudgetGuard budget,
    UsageService usage,
    OrganizationContext orgContext) : ControllerBase
{
    [HttpPost("run")]
    public async Task<ActionResult<IEnumerable<PredictionResultDto>>> Run(
        [FromBody] RunPredictionRequest req,
        CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var roleErr = await orgContext.RequireRoleAsync(OrgRoles.Member, ct);
        if (roleErr != null) return roleErr;

        if (!await billing.IsEntitledAsync(orgId!.Value, ct))
            return StatusCode(402, "Subscription required for this organization. Contact sales for an invoice plan.");

        var budgetStatus = await budget.CheckAsync(orgId.Value, ct);
        if (budgetStatus.IsBlocked)
            return StatusCode(StatusCodes.Status429TooManyRequests,
                $"Daily AI budget reached (${budgetStatus.HardCapUsd:0.00}). Predictions will resume after UTC midnight or when an Admin raises the cap.");

        if (req.TaskId is null && req.ProjectId is null)
            return BadRequest("Provide taskId or projectId.");

        if (req.TaskId is not null)
        {
            var p = await predictions.RunForTaskAsync(req.TaskId.Value, orgId.Value, ct);
            if (p is null) return NotFound();
            await usage.RecordAsync(orgId.Value, null, UsageEventKinds.Prediction, UsageService.PredictionCostMills, ct: ct);
            return Ok(new[]
            {
                new PredictionResultDto(p.Id, p.TaskId, p.RiskLevel, p.DelayDays, p.Summary, p.Recommendation, p.CreatedAt),
            });
        }

        var results = await predictions.RunForProjectAsync(req.ProjectId!.Value, orgId.Value, ct);
        if (results.Count == 0) return NotFound();

        await usage.RecordAsync(orgId.Value, null, UsageEventKinds.Prediction, UsageService.PredictionCostMills * results.Count, ct: ct);

        return Ok(results.Select(p =>
            new PredictionResultDto(p.Id, p.TaskId, p.RiskLevel, p.DelayDays, p.Summary, p.Recommendation, p.CreatedAt)));
    }
}
