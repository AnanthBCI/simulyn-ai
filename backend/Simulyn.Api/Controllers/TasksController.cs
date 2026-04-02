using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Dtos;
using Simulyn.Api.Models.Entities;

namespace Simulyn.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class TasksController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("project/{projectId:guid}")]
    public async Task<ActionResult<IEnumerable<TaskDto>>> ByProject(Guid projectId, CancellationToken ct)
    {
        var ok = await db.Projects.AnyAsync(p => p.Id == projectId && p.UserId == UserId, ct);
        if (!ok) return NotFound();

        var tasks = await db.Tasks
            .AsNoTracking()
            .Where(t => t.ProjectId == projectId)
            .Include(t => t.Predictions)
            .ToListAsync(ct);

        var dtos = tasks.Select(t =>
        {
            var last = t.Predictions.OrderByDescending(x => x.CreatedAt).FirstOrDefault();
            return new TaskDto(t.Id, t.ProjectId, t.Name, t.StartDate, t.EndDate, t.Progress, t.Status,
                last?.RiskLevel, last?.DelayDays);
        }).OrderBy(t => t.StartDate);

        return Ok(dtos);
    }

    [HttpPost]
    public async Task<ActionResult<TaskDto>> Create([FromBody] CreateTaskRequest req, CancellationToken ct)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == req.ProjectId && p.UserId == UserId, ct);
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
            CreatedAt = DateTime.UtcNow
        };
        db.Tasks.Add(task);
        await db.SaveChangesAsync(ct);
        return Ok(new TaskDto(task.Id, task.ProjectId, task.Name, task.StartDate, task.EndDate, task.Progress, task.Status, null, null));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TaskDto>> Update(Guid id, [FromBody] UpdateTaskRequest req, CancellationToken ct)
    {
        var task = await db.Tasks.Include(t => t.Project).Include(t => t.Predictions)
            .FirstOrDefaultAsync(t => t.Id == id, ct);
        if (task == null || task.Project.UserId != UserId) return NotFound();

        if (req.Name != null) task.Name = req.Name.Trim();
        if (req.StartDate.HasValue) task.StartDate = req.StartDate.Value;
        if (req.EndDate.HasValue) task.EndDate = req.EndDate.Value;
        if (req.Progress.HasValue) task.Progress = Math.Clamp(req.Progress.Value, 0, 100);
        if (req.Status != null) task.Status = req.Status;

        await db.SaveChangesAsync(ct);

        var last = task.Predictions.OrderByDescending(x => x.CreatedAt).FirstOrDefault();
        return Ok(new TaskDto(task.Id, task.ProjectId, task.Name, task.StartDate, task.EndDate, task.Progress, task.Status,
            last?.RiskLevel, last?.DelayDays));
    }
}
