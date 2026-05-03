using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Entities;

namespace Simulyn.Api.Services;

/// <summary>
/// Runs predictions for one or more tasks. Centralised so it can be triggered from
/// the predictions controller, the import-schedule flow, sample-data seed, etc.
/// All scope checks are by organization.
/// </summary>
public class PredictionService(AppDbContext db, AiClientService ai, NotificationService notifications, ILogger<PredictionService> logger)
{
    private const int MaxConcurrentAiCalls = 5;

    public async Task<IReadOnlyList<Prediction>> RunForProjectAsync(
        Guid projectId,
        Guid organizationId,
        CancellationToken ct = default)
    {
        var project = await db.Projects
            .Include(p => p.Tasks)
            .FirstOrDefaultAsync(p => p.Id == projectId && p.OrganizationId == organizationId, ct);
        if (project == null) return Array.Empty<Prediction>();

        return await RunForTasksAsync(project, project.Tasks.ToList(), ct);
    }

    public async Task<Prediction?> RunForTaskAsync(
        Guid taskId,
        Guid organizationId,
        CancellationToken ct = default)
    {
        var task = await db.Tasks
            .Include(t => t.Project)
            .FirstOrDefaultAsync(t => t.Id == taskId, ct);
        if (task == null || task.Project.OrganizationId != organizationId) return null;

        var results = await RunForTasksAsync(task.Project, [task], ct);
        return results.FirstOrDefault();
    }

    private async Task<IReadOnlyList<Prediction>> RunForTasksAsync(
        Project project,
        IReadOnlyList<ProjectTask> tasks,
        CancellationToken ct)
    {
        if (tasks.Count == 0) return Array.Empty<Prediction>();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        using var gate = new SemaphoreSlim(MaxConcurrentAiCalls);

        var work = tasks.Select(async task =>
        {
            await gate.WaitAsync(ct);
            try
            {
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
                    /* fall through to deterministic */
                }

                if (aiRes != null)
                {
                    return new Prediction
                    {
                        Id = Guid.NewGuid(),
                        TaskId = task.Id,
                        RiskLevel = aiRes.RiskLevel,
                        DelayDays = aiRes.DelayDays,
                        Summary = aiRes.Summary,
                        Recommendation = aiRes.Recommendation,
                        CreatedAt = DateTime.UtcNow,
                    };
                }

                var local = RuleBasedPrediction.Evaluate(task.StartDate, task.EndDate, task.Progress, today);
                return new Prediction
                {
                    Id = Guid.NewGuid(),
                    TaskId = task.Id,
                    RiskLevel = local.RiskLevel,
                    DelayDays = local.DelayDays,
                    Summary = local.Summary,
                    Recommendation = local.Recommendation,
                    CreatedAt = DateTime.UtcNow,
                };
            }
            finally
            {
                gate.Release();
            }
        });

        // Snapshot of the most recent pre-existing prediction per task, so we can
        // detect crossovers (Medium/Low → High) and fire a notification.
        var taskIds = tasks.Select(t => t.Id).ToList();
        var priorRiskByTask = await db.Predictions
            .Where(p => taskIds.Contains(p.TaskId))
            .GroupBy(p => p.TaskId)
            .Select(g => new { TaskId = g.Key, LatestRisk = g.OrderByDescending(p => p.CreatedAt).First().RiskLevel })
            .ToDictionaryAsync(x => x.TaskId, x => x.LatestRisk, ct);

        var predictions = await Task.WhenAll(work);
        db.Predictions.AddRange(predictions);
        await db.SaveChangesAsync(ct);

        // Fire High-risk crossover alerts — fire-and-forget so prediction RTT isn't affected.
        foreach (var p in predictions)
        {
            if (!string.Equals(p.RiskLevel, "High", StringComparison.OrdinalIgnoreCase)) continue;
            var prior = priorRiskByTask.GetValueOrDefault(p.TaskId);
            if (string.Equals(prior, "High", StringComparison.OrdinalIgnoreCase)) continue; // already high — no alert
            var task = tasks.FirstOrDefault(t => t.Id == p.TaskId);
            if (task == null) continue;
            _ = Task.Run(async () =>
            {
                try
                {
                    await notifications.NotifyHighRiskAsync(
                        project.OrganizationId,
                        project.Id,
                        project.Name,
                        task.Id,
                        task.Name,
                        p.DelayDays,
                        p.Summary,
                        CancellationToken.None);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "High-risk notification failed for task {TaskId}", task.Id);
                }
            });
        }

        return predictions;
    }
}
