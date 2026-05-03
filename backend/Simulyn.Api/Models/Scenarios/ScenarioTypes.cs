namespace Simulyn.Api.Models.Scenarios;

/// <summary>
/// The five what-if scenarios supported by Simulyn. Strings match the
/// <c>Simulations.ScenarioType</c> column (migration 2026-05-03) so don't rename
/// without a data migration.
/// </summary>
public static class ScenarioTypes
{
    /// <summary>Slip every task by N days.</summary>
    public const string UniformSlip = "UniformSlip";

    /// <summary>Slip one specific task by N days; downstream impact depends on its position.</summary>
    public const string SingleTaskSlip = "SingleTaskSlip";

    /// <summary>Add extra crew / resources; compresses remaining work.</summary>
    public const string AddResource = "AddResource";

    /// <summary>Pause outdoor work for a weather window.</summary>
    public const string WeatherPause = "WeatherPause";

    /// <summary>Remove N tasks from scope (change order, de-scoping).</summary>
    public const string ScopeReduction = "ScopeReduction";

    public static readonly IReadOnlyList<string> All = new[]
    {
        UniformSlip,
        SingleTaskSlip,
        AddResource,
        WeatherPause,
        ScopeReduction,
    };

    public static bool IsKnown(string? type) =>
        !string.IsNullOrWhiteSpace(type) && All.Contains(type);

    /// <summary>User-facing label for the UI.</summary>
    public static string Label(string type) => type switch
    {
        UniformSlip => "Uniform slip",
        SingleTaskSlip => "Single task slip",
        AddResource => "Add resource",
        WeatherPause => "Weather pause",
        ScopeReduction => "Scope reduction",
        _ => type,
    };
}
