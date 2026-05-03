using Simulyn.Api.Models.Entities;

namespace Simulyn.Api.Models.Scenarios;

/// <summary>
/// Compact view of a project handed to the scenario math. Lets the engine stay
/// pure (no EF types) and keeps the math easy to unit-test later.
/// </summary>
public sealed record ScenarioProjectSnapshot(
    Guid ProjectId,
    string Name,
    DateOnly Start,
    DateOnly End,
    IReadOnlyList<ScenarioTaskSnapshot> Tasks);

public sealed record ScenarioTaskSnapshot(
    Guid Id,
    string Name,
    DateOnly Start,
    DateOnly End,
    int Progress);

public sealed record ScenarioOutcome(
    /// <summary>Predicted change in project finish, in days. Positive = later, negative = earlier.</summary>
    int PredictedDelayDays,
    /// <summary>Short deterministic summary of what the math did. The AI service rewrites this.</summary>
    string DeterministicSummary,
    /// <summary>Helpful signals the AI service can reference in its narrative.</summary>
    IReadOnlyDictionary<string, object> Signals);

/// <summary>
/// Per-type deterministic math. The AI service narrates; these numbers drive
/// the chart and the comparison table. Keep it simple and predictable — the
/// demo value is the per-type variety, not sophistication.
/// </summary>
public static class ScenarioMath
{
    public static ScenarioOutcome Run(ScenarioProjectSnapshot project, ScenarioConfig config, DateOnly today)
    {
        return config switch
        {
            UniformSlipConfig c => Uniform(project, c),
            SingleTaskSlipConfig c => SingleTask(project, c, today),
            AddResourceConfig c => AddResource(project, c, today),
            WeatherPauseConfig c => WeatherPause(project, c),
            ScopeReductionConfig c => ScopeReduction(project, c),
            _ => throw new ArgumentOutOfRangeException(nameof(config), $"Unknown scenario type: {config.ScenarioType}"),
        };
    }

    private static ScenarioOutcome Uniform(ScenarioProjectSnapshot project, UniformSlipConfig c)
    {
        // Matches the legacy Phase 1 math so existing demos reproduce.
        var predicted = (int)Math.Round(c.InputDelayDays * (1 + project.Tasks.Count * 0.05));
        var newEnd = project.End.AddDays(predicted);
        return new ScenarioOutcome(
            predicted,
            $"Every task slips {c.InputDelayDays} day(s); finish shifts to ~{newEnd:yyyy-MM-dd}.",
            new Dictionary<string, object>
            {
                ["input_delay_days"] = c.InputDelayDays,
                ["task_count"] = project.Tasks.Count,
                ["new_end_date"] = newEnd.ToString("yyyy-MM-dd"),
            });
    }

    private static ScenarioOutcome SingleTask(ScenarioProjectSnapshot project, SingleTaskSlipConfig c, DateOnly today)
    {
        var task = project.Tasks.FirstOrDefault(t => t.Id == c.TaskId);
        if (task == null)
        {
            return new ScenarioOutcome(
                c.DelayDays,
                $"Selected task not found; assuming uniform {c.DelayDays}-day slip.",
                new Dictionary<string, object> { ["warning"] = "task_not_found" });
        }

        // Late-project slips hit harder: tasks finishing in the last third of the
        // window propagate ~85% of their slip, early tasks ~35% (they can be
        // re-sequenced). The midpoint is ~60%.
        var projectDays = Math.Max(1, project.End.DayNumber - project.Start.DayNumber);
        var taskMidpoint = (task.Start.DayNumber + task.End.DayNumber) / 2;
        var positionPct = Math.Clamp(
            (taskMidpoint - project.Start.DayNumber) / (double)projectDays,
            0.0, 1.0);
        var criticality = 0.35 + positionPct * 0.5;
        var predicted = (int)Math.Round(c.DelayDays * criticality);
        return new ScenarioOutcome(
            predicted,
            $"\"{task.Name}\" slips {c.DelayDays} day(s); roughly {predicted} propagate to project finish.",
            new Dictionary<string, object>
            {
                ["task_name"] = task.Name,
                ["task_delay_days"] = c.DelayDays,
                ["position_pct"] = Math.Round(positionPct * 100),
                ["criticality_factor"] = Math.Round(criticality, 2),
            });
    }

    private static ScenarioOutcome AddResource(ScenarioProjectSnapshot project, AddResourceConfig c, DateOnly today)
    {
        var multiplier = Math.Clamp(c.CapacityMultiplier, 0.05, 2.0);
        // Compute remaining work in task-days (sum of uncompleted portion of each task).
        var remaining = 0.0;
        foreach (var t in project.Tasks)
        {
            var span = Math.Max(1, t.End.DayNumber - t.Start.DayNumber);
            remaining += span * (1 - t.Progress / 100.0);
        }
        // A single crew finishes today's plan in `daysLeft`; adding +M capacity makes it `daysLeft / (1+M)`.
        var daysLeft = Math.Max(1, project.End.DayNumber - today.DayNumber);
        var compressed = daysLeft / (1.0 + multiplier);
        var predicted = (int)Math.Round(compressed - daysLeft); // negative = earlier
        return new ScenarioOutcome(
            predicted,
            $"+{multiplier:P0} capacity compresses remaining work by ~{-predicted} day(s).",
            new Dictionary<string, object>
            {
                ["capacity_multiplier"] = multiplier,
                ["remaining_task_days"] = (int)Math.Round(remaining),
                ["days_left"] = daysLeft,
            });
    }

    private static ScenarioOutcome WeatherPause(ScenarioProjectSnapshot project, WeatherPauseConfig c)
    {
        // Weather pauses hit the critical path 1:1 modulo a small cushion baked
        // into most schedules. We assume 20% of the pause can be absorbed.
        var absorbed = (int)Math.Round(c.PauseDays * 0.2);
        var predicted = Math.Max(0, c.PauseDays - absorbed);
        var newEnd = project.End.AddDays(predicted);
        return new ScenarioOutcome(
            predicted,
            $"{c.PauseDays}-day weather pause; finish shifts to ~{newEnd:yyyy-MM-dd} ({absorbed} day(s) absorbed).",
            new Dictionary<string, object>
            {
                ["pause_days"] = c.PauseDays,
                ["absorbed_days"] = absorbed,
                ["new_end_date"] = newEnd.ToString("yyyy-MM-dd"),
            });
    }

    private static ScenarioOutcome ScopeReduction(ScenarioProjectSnapshot project, ScopeReductionConfig c)
    {
        var removed = Math.Clamp(c.TasksRemoved, 0, project.Tasks.Count);
        if (removed == 0)
        {
            return new ScenarioOutcome(0, "No tasks removed; finish unchanged.", new Dictionary<string, object>
            {
                ["tasks_removed"] = 0,
            });
        }
        var avgSpan = project.Tasks.Count == 0
            ? 1
            : project.Tasks.Average(t => Math.Max(1, t.End.DayNumber - t.Start.DayNumber));
        // Halved: most dropped tasks overlap with others, so we rarely claw back the full duration.
        var predicted = -(int)Math.Round(removed * avgSpan * 0.5);
        return new ScenarioOutcome(
            predicted,
            $"Dropping {removed} task(s) (avg {Math.Round(avgSpan)}-day span) pulls finish in by ~{-predicted} day(s).",
            new Dictionary<string, object>
            {
                ["tasks_removed"] = removed,
                ["avg_task_days"] = Math.Round(avgSpan, 1),
            });
    }
}
