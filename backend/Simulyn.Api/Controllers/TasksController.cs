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
public class TasksController(
    AppDbContext db,
    PredictionService predictions,
    BillingService billing,
    OrganizationContext orgContext) : ControllerBase
{
    [HttpGet("project/{projectId:guid}")]
    public async Task<ActionResult<IEnumerable<TaskDto>>> ByProject(Guid projectId, CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;

        var ok = await db.Projects.AnyAsync(p => p.Id == projectId && p.OrganizationId == orgId, ct);
        if (!ok) return NotFound();

        var tasks = await db.Tasks
            .AsNoTracking()
            .Where(t => t.ProjectId == projectId)
            .Include(t => t.Predictions)
            .ToListAsync(ct);

        return Ok(tasks.Select(ToDto).OrderBy(t => t.StartDate));
    }

    [HttpPost]
    public async Task<ActionResult<TaskDto>> Create([FromBody] CreateTaskRequest req, CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var roleErr = await orgContext.RequireRoleAsync(OrgRoles.Member, ct);
        if (roleErr != null) return roleErr;

        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == req.ProjectId && p.OrganizationId == orgId, ct);
        if (project == null) return NotFound("Project not found.");

        var task = new ProjectTask
        {
            Id = Guid.NewGuid(),
            ProjectId = req.ProjectId,
            Name = req.Name.Trim(),
            StartDate = req.StartDate,
            EndDate = req.EndDate,
            Progress = Math.Clamp(req.Progress, 0, 100),
            Status = string.IsNullOrWhiteSpace(req.Status) ? "InProgress" : req.Status!,
            CreatedAt = DateTime.UtcNow,
        };
        db.Tasks.Add(task);
        await db.SaveChangesAsync(ct);

        if (await billing.IsEntitledAsync(orgId!.Value, ct))
        {
            try { await predictions.RunForTaskAsync(task.Id, orgId.Value, ct); }
            catch { /* swallow */ }
        }

        var fresh = await db.Tasks.AsNoTracking()
            .Include(t => t.Predictions)
            .FirstAsync(t => t.Id == task.Id, ct);
        return Ok(ToDto(fresh));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TaskDto>> Update(Guid id, [FromBody] UpdateTaskRequest req, CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var roleErr = await orgContext.RequireRoleAsync(OrgRoles.Member, ct);
        if (roleErr != null) return roleErr;

        var task = await db.Tasks.Include(t => t.Project).Include(t => t.Predictions)
            .FirstOrDefaultAsync(t => t.Id == id, ct);
        if (task == null || task.Project.OrganizationId != orgId) return NotFound();

        var progressChanged = false;
        if (req.Name != null) task.Name = req.Name.Trim();
        if (req.StartDate.HasValue) task.StartDate = req.StartDate.Value;
        if (req.EndDate.HasValue) task.EndDate = req.EndDate.Value;
        if (req.Progress.HasValue)
        {
            var clamped = Math.Clamp(req.Progress.Value, 0, 100);
            progressChanged = clamped != task.Progress;
            task.Progress = clamped;
        }
        if (req.Status != null) task.Status = req.Status;

        await db.SaveChangesAsync(ct);

        if (progressChanged && await billing.IsEntitledAsync(orgId!.Value, ct))
        {
            try { await predictions.RunForTaskAsync(task.Id, orgId.Value, ct); }
            catch { /* swallow */ }
        }

        var fresh = await db.Tasks.AsNoTracking()
            .Include(t => t.Predictions)
            .FirstAsync(t => t.Id == task.Id, ct);
        return Ok(ToDto(fresh));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var roleErr = await orgContext.RequireRoleAsync(OrgRoles.Member, ct);
        if (roleErr != null) return roleErr;

        var task = await db.Tasks.Include(t => t.Project)
            .FirstOrDefaultAsync(t => t.Id == id, ct);
        if (task == null || task.Project.OrganizationId != orgId) return NotFound();

        db.Tasks.Remove(task);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static TaskDto ToDto(ProjectTask t)
    {
        // Sort once, use both the newest and the one before it.
        var ordered = t.Predictions.OrderByDescending(x => x.CreatedAt).ToList();
        var last = ordered.ElementAtOrDefault(0);
        var prev = ordered.ElementAtOrDefault(1);
        return new TaskDto(
            t.Id, t.ProjectId, t.Name, t.StartDate, t.EndDate, t.Progress, t.Status,
            last?.RiskLevel, last?.DelayDays, last?.Summary, last?.Recommendation, last?.CreatedAt,
            prev?.RiskLevel, prev?.DelayDays, prev?.CreatedAt);
    }
}
