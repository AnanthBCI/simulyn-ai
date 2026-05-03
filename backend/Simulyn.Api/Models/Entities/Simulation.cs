namespace Simulyn.Api.Models.Entities;

/// <summary>
/// One persisted what-if simulation. Append-only — every "Run scenario" click
/// writes a new row so users can browse history and compare past scenarios.
///
/// Until Phase 3 the only ScenarioType was "UniformSlip" (slip every task by N
/// days). The library now supports several types; per-type inputs are stored
/// as JSON in <see cref="ScenarioConfig"/> so adding a new type doesn't need
/// a schema change.
/// </summary>
public class Simulation
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }

    /// <summary>Legacy field kept for back-compat — equals input_delay_days for UniformSlip,
    /// 0 for scenarios where a single integer doesn't capture the intent.</summary>
    public int InputDelay { get; set; }

    /// <summary>Days the model thinks the project end will move (positive = later, negative = earlier).</summary>
    public int PredictedDelay { get; set; }

    /// <summary>2-4 sentence narrative from the LLM explaining what this scenario means.</summary>
    public string? ImpactSummary { get; set; }

    public DateTime CreatedAt { get; set; }

    /// <summary>One of: UniformSlip, SingleTaskSlip, AddResource, WeatherPause, ScopeReduction.</summary>
    public string ScenarioType { get; set; } = "UniformSlip";

    /// <summary>Scenario-specific inputs as JSON. Null/empty for legacy UniformSlip rows.</summary>
    public string? ScenarioConfig { get; set; }

    /// <summary>Short LLM-generated card title, e.g. "Wiring slips 5 days → +3 day project finish".</summary>
    public string? Headline { get; set; }

    public Project Project { get; set; } = null!;
}
