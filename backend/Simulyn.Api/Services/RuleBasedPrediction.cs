namespace Simulyn.Api.Services;

/// <summary>MVP rule engine (mirrors Python Phase 1). Used when AI service is unavailable.</summary>
public static class RuleBasedPrediction
{
    public static (string RiskLevel, int DelayDays, string Summary, string Recommendation) Evaluate(
        DateOnly taskStart,
        DateOnly taskEnd,
        int progressPercent,
        DateOnly today)
    {
        var totalDays = Math.Max(1, taskEnd.DayNumber - taskStart.DayNumber);
        var elapsed = Math.Clamp(today.DayNumber - taskStart.DayNumber, 0, totalDays);
        var expectedProgress = totalDays == 0 ? 100 : (int)Math.Round(100.0 * elapsed / totalDays);
        var gap = expectedProgress - progressPercent;

        int delayDays;
        string risk;
        if (gap <= 5)
        {
            risk = "Low";
            delayDays = Math.Max(0, gap / 5);
        }
        else if (gap <= 15)
        {
            risk = "Medium";
            delayDays = Math.Max(1, gap / 3);
        }
        else
        {
            risk = "High";
            delayDays = Math.Max(2, gap / 2);
        }

        var summary = $"Expected progress ~{expectedProgress}% vs actual {progressPercent}%.";
        var rec = risk switch
        {
            "High" => "• Add 2 workers\n• Increase working hours\n• Re-sequence dependent trades",
            "Medium" => "• Add 1 worker or extend shift\n• Review blockers daily",
            _ => "• Monitor weekly; no immediate action"
        };

        return (risk, delayDays, summary, rec);
    }

    public static (int PredictedDelay, string ImpactSummary) SimulateProjectDelay(
        DateOnly projectStart,
        DateOnly projectEnd,
        int inputDelayDays,
        int taskCount)
    {
        var span = Math.Max(1, projectEnd.DayNumber - projectStart.DayNumber);
        var predicted = (int)Math.Round(inputDelayDays * (1 + taskCount * 0.05));
        var newEnd = projectEnd.AddDays(predicted);
        var summary =
            $"With an input slip of {inputDelayDays} day(s), the model estimates ~{predicted} day(s) impact on the project finish (new end ≈ {newEnd:yyyy-MM-dd}, {taskCount} tasks in scope).";
        return (predicted, summary);
    }
}
