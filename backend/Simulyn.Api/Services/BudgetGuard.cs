namespace Simulyn.Api.Services;

/// <summary>
/// Per-org daily LLM budget guardrail. Soft cap = warning in the API response;
/// hard cap = return 429 from expensive endpoints.
/// Config under <c>Budget</c> section; units are mills (1/1000 USD).
/// Defaults: soft 5000 mills ($5), hard 20000 mills ($20).
/// </summary>
public class BudgetGuard(UsageService usage, IConfiguration config)
{
    public int SoftCapMills => int.TryParse(config["Budget:SoftCapMills"], out var v) ? v : 5_000;
    public int HardCapMills => int.TryParse(config["Budget:HardCapMills"], out var v) ? v : 20_000;

    public async Task<BudgetStatus> CheckAsync(Guid orgId, CancellationToken ct = default)
    {
        var today = await usage.GetTodayMillsAsync(orgId, ct);
        var level = today >= HardCapMills ? BudgetLevel.Blocked
                  : today >= SoftCapMills ? BudgetLevel.Warning
                  : BudgetLevel.Ok;
        return new BudgetStatus(today, SoftCapMills, HardCapMills, level);
    }
}

public enum BudgetLevel { Ok, Warning, Blocked }

public record BudgetStatus(int TodayMills, int SoftCapMills, int HardCapMills, BudgetLevel Level)
{
    public bool IsBlocked => Level == BudgetLevel.Blocked;
    public bool IsWarning => Level == BudgetLevel.Warning;
    public decimal TodayUsd => TodayMills / 1000m;
    public decimal HardCapUsd => HardCapMills / 1000m;
}
