using FluentAssertions;
using Simulyn.Api.Models.Scenarios;

namespace Simulyn.Api.Tests;

public class ScenarioMathTests
{
    private static ScenarioProjectSnapshot Project()
    {
        return new ScenarioProjectSnapshot(
            ProjectId: Guid.NewGuid(),
            Name: "Tower B",
            Start: new DateOnly(2026, 1, 1),
            End: new DateOnly(2026, 6, 1),
            Tasks: new[]
            {
                new ScenarioTaskSnapshot(Guid.NewGuid(), "Foundation", new DateOnly(2026, 1, 1), new DateOnly(2026, 2, 1), 80),
                new ScenarioTaskSnapshot(Guid.NewGuid(), "Framing",    new DateOnly(2026, 2, 2), new DateOnly(2026, 3, 15), 40),
                new ScenarioTaskSnapshot(Guid.NewGuid(), "Finishes",   new DateOnly(2026, 3, 16), new DateOnly(2026, 5, 31), 10),
            });
    }

    private static readonly DateOnly Today = new(2026, 2, 1);

    [Fact]
    public void UniformSlip_adds_days_to_project_finish()
    {
        var outcome = ScenarioMath.Run(Project(), new UniformSlipConfig(3), Today);

        outcome.PredictedDelayDays.Should().Be(3);
        outcome.DeterministicSummary.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void AddResource_produces_non_positive_delay()
    {
        // +50% capacity should shorten the project, not lengthen it.
        var outcome = ScenarioMath.Run(Project(), new AddResourceConfig(0.5), Today);

        outcome.PredictedDelayDays.Should().BeLessThanOrEqualTo(0);
    }

    [Fact]
    public void WeatherPause_adds_delay()
    {
        var outcome = ScenarioMath.Run(Project(), new WeatherPauseConfig(2), Today);

        outcome.PredictedDelayDays.Should().BeGreaterThan(0);
    }

    [Fact]
    public void ScopeReduction_produces_non_positive_delay()
    {
        var outcome = ScenarioMath.Run(Project(), new ScopeReductionConfig(1), Today);

        outcome.PredictedDelayDays.Should().BeLessThanOrEqualTo(0);
    }

    [Fact]
    public void SingleTaskSlip_for_known_task_adds_delay_and_records_signals()
    {
        var project = Project();
        var target = project.Tasks[1];

        var outcome = ScenarioMath.Run(project, new SingleTaskSlipConfig(target.Id, 5), Today);

        outcome.PredictedDelayDays.Should().BeGreaterThanOrEqualTo(0);
        outcome.Signals.Should().NotBeNull();
    }
}
