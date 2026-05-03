namespace Simulyn.Api.Models.Scenarios;

/// <summary>
/// Common shape for every scenario input. Only <see cref="ScenarioType"/> is
/// mandatory; each record below narrows the rest. These types are serialised as
/// JSON into <c>Simulations.ScenarioConfig</c> so schema migrations aren't
/// needed when we add a new scenario type.
/// </summary>
public abstract record ScenarioConfig(string ScenarioType);

/// <summary>Slip every task by <see cref="InputDelayDays"/>. The legacy scenario.</summary>
public sealed record UniformSlipConfig(int InputDelayDays)
    : ScenarioConfig(ScenarioTypes.UniformSlip);

/// <summary>Slip a single named task. The downstream impact scales with how
/// far through the project we are when that task slips.</summary>
/// <param name="TaskId">Target task; must belong to the project.</param>
/// <param name="DelayDays">How many days the chosen task slips.</param>
public sealed record SingleTaskSlipConfig(Guid TaskId, int DelayDays)
    : ScenarioConfig(ScenarioTypes.SingleTaskSlip);

/// <summary>Add extra crew to the project. Modelled as a simple compression of
/// remaining work: <c>new duration = old duration / (1 + capacityMultiplier)</c>.
/// <see cref="CapacityMultiplier"/> is a decimal where 0.25 = +25% capacity.</summary>
public sealed record AddResourceConfig(double CapacityMultiplier)
    : ScenarioConfig(ScenarioTypes.AddResource);

/// <summary>Pause all tasks during a weather window. The whole project end
/// shifts by roughly the pause length, minus any cushion already in the plan.</summary>
public sealed record WeatherPauseConfig(int PauseDays)
    : ScenarioConfig(ScenarioTypes.WeatherPause);

/// <summary>Remove <see cref="TasksRemoved"/> tasks from scope. Modelled as
/// returning the average task duration per removed item, halved to be
/// conservative (most dropped tasks overlap with others).</summary>
public sealed record ScopeReductionConfig(int TasksRemoved)
    : ScenarioConfig(ScenarioTypes.ScopeReduction);
