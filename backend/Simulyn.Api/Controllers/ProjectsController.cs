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
public class ProjectsController(AppDbContext db, ExcelScheduleImportService import) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProjectDto>>> List(CancellationToken ct)
    {
        var projects = await db.Projects
            .AsNoTracking()
            .Where(p => p.UserId == UserId)
            .Include(p => p.Tasks)
            .ThenInclude(t => t.Predictions)
            .ToListAsync(ct);

        var result = projects.Select(p =>
        {
            var high = p.Tasks.Count(t =>
            {
                var last = t.Predictions.OrderByDescending(x => x.CreatedAt).FirstOrDefault();
                return last?.RiskLevel == "High";
            });
            return new ProjectDto(p.Id, p.Name, p.StartDate, p.EndDate, p.Status, p.Tasks.Count, high);
        }).ToList();

        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<ProjectDto>> Create([FromBody] CreateProjectRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest("Name required.");
        var project = new Project
        {
            Id = Guid.NewGuid(),
            UserId = UserId,
            Name = req.Name.Trim(),
            StartDate = req.StartDate,
            EndDate = req.EndDate,
            Status = string.IsNullOrWhiteSpace(req.Status) ? "Active" : req.Status!,
            CreatedAt = DateTime.UtcNow
        };
        db.Projects.Add(project);
        await db.SaveChangesAsync(ct);
        return Ok(new ProjectDto(project.Id, project.Name, project.StartDate, project.EndDate, project.Status, 0, 0));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var p = await db.Projects.FirstOrDefaultAsync(x => x.Id == id && x.UserId == UserId, ct);
        if (p == null) return NotFound();
        db.Projects.Remove(p);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectDto>> Get(Guid id, CancellationToken ct)
    {
        var p = await db.Projects.AsNoTracking()
            .Include(x => x.Tasks)
            .ThenInclude(t => t.Predictions)
            .FirstOrDefaultAsync(x => x.Id == id && x.UserId == UserId, ct);
        if (p == null) return NotFound();
        var high = p.Tasks.Count(t =>
        {
            var last = t.Predictions.OrderByDescending(x => x.CreatedAt).FirstOrDefault();
            return last?.RiskLevel == "High";
        });
        return Ok(new ProjectDto(p.Id, p.Name, p.StartDate, p.EndDate, p.Status, p.Tasks.Count, high));
    }

    [HttpPost("{id:guid}/import-schedule")]
    [RequestSizeLimit(20_000_000)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ImportScheduleResultDto>> ImportSchedule(Guid id, IFormFile? file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest("Excel file is required.");
        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest("Upload a .xlsx file (Excel workbook).");

        await using var stream = file.OpenReadStream();
        try
        {
            var result = await import.ImportAsync(id, UserId, stream, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
