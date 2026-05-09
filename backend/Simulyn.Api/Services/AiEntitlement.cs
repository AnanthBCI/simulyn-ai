using Microsoft.AspNetCore.Mvc;

namespace Simulyn.Api.Services;

/// <summary>
/// Single chokepoint for "is this org allowed to spend money on an LLM call right now?"
/// Combines entitlement (Trial valid / Active subscription) with the daily LLM budget cap.
/// Pre-pilot every AI endpoint must call <see cref="GuardAsync"/> before invoking
/// <c>AiClientService</c>; on success, call <see cref="RecordAsync"/> after the call to
/// debit the running daily total. Centralising this means new AI endpoints inherit the
/// policy automatically and "did we forget to gate it?" stops being a code-review question.
/// </summary>
public class AiEntitlement(BillingService billing, BudgetGuard budget, UsageService usage)
{
    /// <summary>
    /// Returns null on success — caller may proceed. Returns an <see cref="ActionResult"/>
    /// (402 not-entitled, or 429 over-budget with a Retry-After header pointing at UTC midnight)
    /// when the call should be refused.
    /// </summary>
    public async Task<ActionResult?> GuardAsync(Guid orgId, HttpResponse response, CancellationToken ct = default)
    {
        if (!await billing.IsEntitledAsync(orgId, ct))
        {
            return new ObjectResult(
                "Subscription required for this organization. Contact sales for an invoice plan, or upgrade in /admin/billing.")
            {
                StatusCode = StatusCodes.Status402PaymentRequired,
            };
        }

        var status = await budget.CheckAsync(orgId, ct);
        if (status.IsBlocked)
        {
            // Tell the client when to retry — UTC midnight resets the daily budget.
            var nowUtc = DateTime.UtcNow;
            var resetUtc = nowUtc.Date.AddDays(1);
            var retryAfterSecs = (int)Math.Ceiling((resetUtc - nowUtc).TotalSeconds);
            response.Headers["Retry-After"] = retryAfterSecs.ToString();

            return new ObjectResult(new
            {
                error = "budget_exceeded",
                message = $"Daily AI budget reached (${status.HardCapUsd:0.00}). Resets at UTC midnight.",
                resetAtUtc = resetUtc,
                retryAfterSeconds = retryAfterSecs,
            })
            {
                StatusCode = StatusCodes.Status429TooManyRequests,
            };
        }

        return null;
    }

    /// <summary>
    /// Record a successful LLM call against the daily budget. Failures here are
    /// non-fatal (logged, not thrown) — we'd rather under-bill than break the
    /// user-facing endpoint when usage tracking misbehaves.
    /// </summary>
    public Task RecordAsync(Guid orgId, string kind, int costMills, CancellationToken ct = default)
        => usage.RecordAsync(orgId, null, kind, costMills, ct: ct);
}
