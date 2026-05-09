using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Dtos;
using Simulyn.Api.Models.Entities;
using Simulyn.Api.Services;
using Stripe;

namespace Simulyn.Api.Controllers;

[ApiController]
[Route("api/billing")]
public class BillingController(
    AppDbContext db,
    StripeBillingService stripe,
    OrganizationContext orgContext,
    BudgetGuard budget,
    ILogger<BillingController> logger) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Budget status for the active org — used by the UI to show warning banners.</summary>
    [Authorize]
    [HttpGet("budget")]
    public async Task<ActionResult<BudgetStatusDto>> GetBudget(CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var status = await budget.CheckAsync(orgId!.Value, ct);
        return Ok(new BudgetStatusDto(status.TodayMills, status.SoftCapMills, status.HardCapMills, status.Level.ToString()));
    }

    /// <summary>Create a Stripe Checkout session to upgrade the active org's plan.</summary>
    [Authorize]
    [HttpPost("checkout")]
    public async Task<ActionResult<CreateCheckoutSessionResponse>> CreateCheckout(
        [FromBody] CreateCheckoutSessionRequest req,
        CancellationToken ct)
    {
        var (orgId, forbidden) = await orgContext.RequireOrgAsync(ct);
        if (forbidden != null) return forbidden;
        var roleErr = await orgContext.RequireRoleAsync(OrgRoles.Admin, ct);
        if (roleErr != null) return roleErr;

        if (!stripe.IsConfigured)
            return StatusCode(503, "Self-serve billing is not configured on this deployment. Contact sales for an invoice plan.");

        var me = await db.Users.FirstAsync(u => u.Id == UserId, ct);
        try
        {
            var session = await stripe.CreateCheckoutSessionAsync(orgId!.Value, req.Plan, me.Email, ct);
            return Ok(new CreateCheckoutSessionResponse(session.Id, session.Url));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// Stripe webhook. Must be reachable from stripe (set up the endpoint in the Stripe dashboard
    /// and put the signing secret in <c>Stripe:WebhookSecret</c>).
    /// </summary>
    [AllowAnonymous]
    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook(CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body);
        var rawJson = await reader.ReadToEndAsync(ct);
        var signature = Request.Headers["Stripe-Signature"].ToString();

        Event stripeEvent;
        try
        {
            stripeEvent = stripe.ConstructEvent(rawJson, signature);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Stripe webhook signature validation failed");
            return BadRequest("Invalid signature.");
        }

        // Idempotency: Stripe retries on 5xx + occasionally on 2xx if our reply
        // is delayed. Skip work if we've already processed this event id.
        var alreadyProcessed = await db.ProcessedStripeEvents
            .AnyAsync(e => e.EventId == stripeEvent.Id, ct);
        if (alreadyProcessed)
        {
            logger.LogInformation("Stripe webhook: event {EventId} ({Type}) already processed, skipping",
                stripeEvent.Id, stripeEvent.Type);
            return Ok(new { received = true, duplicate = true });
        }

        try
        {
            switch (stripeEvent.Type)
            {
                case "checkout.session.completed":
                {
                    var session = stripeEvent.Data.Object as Stripe.Checkout.Session;
                    if (session?.Metadata?.TryGetValue("organization_id", out var orgIdStr) == true
                        && Guid.TryParse(orgIdStr, out var orgId))
                    {
                        var plan = session.Metadata.TryGetValue("plan", out var p) ? p : "Pro";
                        await ActivateOrgAsync(orgId, plan, ct);
                        logger.LogInformation("Stripe checkout.session.completed → org {OrgId} activated on plan {Plan}", orgId, plan);
                    }
                    break;
                }
                case "customer.subscription.updated":
                {
                    // Stripe sends this on plan change, payment success, status change, etc.
                    // Use the subscription's current_period_end as the new entitlement expiry,
                    // and mirror status (active / past_due / canceled / etc.) onto the org.
                    var sub = stripeEvent.Data.Object as Subscription;
                    if (sub?.Metadata?.TryGetValue("organization_id", out var orgIdStr) == true
                        && Guid.TryParse(orgIdStr, out var orgId))
                    {
                        var status = sub.Status?.ToLowerInvariant() switch
                        {
                            "active" or "trialing" => "Active",
                            "past_due" or "unpaid" => "Suspended",
                            "canceled" or "incomplete_expired" => "Suspended",
                            _ => null,
                        };
                        if (status != null)
                        {
                            var plan = sub.Metadata.TryGetValue("plan", out var p) ? p : null;
                            await UpdateOrgSubscriptionAsync(orgId, status, plan, sub.CurrentPeriodEnd, ct);
                            logger.LogInformation("Stripe subscription.updated → org {OrgId} status {Status} expires {Expires}",
                                orgId, status, sub.CurrentPeriodEnd);
                        }
                    }
                    break;
                }
                case "customer.subscription.deleted":
                case "customer.subscription.paused":
                {
                    var sub = stripeEvent.Data.Object as Subscription;
                    if (sub?.Metadata?.TryGetValue("organization_id", out var orgIdStr) == true
                        && Guid.TryParse(orgIdStr, out var orgId))
                    {
                        await SuspendOrgAsync(orgId, ct);
                        logger.LogInformation("Stripe {Type} → org {OrgId} suspended", stripeEvent.Type, orgId);
                    }
                    break;
                }
                default:
                    logger.LogDebug("Stripe webhook: unhandled event type {Type}", stripeEvent.Type);
                    break;
            }

            // Record AFTER successful side-effect — if we crash mid-processing
            // Stripe will retry and we'll redo the (idempotent) operation.
            db.ProcessedStripeEvents.Add(new Models.Entities.ProcessedStripeEvent
            {
                EventId = stripeEvent.Id,
                EventType = stripeEvent.Type,
            });
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException dup) when (dup.InnerException?.Message.Contains("duplicate", StringComparison.OrdinalIgnoreCase) == true
                                            || dup.InnerException?.Message.Contains("unique", StringComparison.OrdinalIgnoreCase) == true)
        {
            // Race: two webhook deliveries hit at the same time. Safe to swallow.
            logger.LogInformation("Stripe webhook: event {EventId} concurrently processed", stripeEvent.Id);
        }

        return Ok(new { received = true });
    }

    private async Task UpdateOrgSubscriptionAsync(Guid orgId, string status, string? plan, DateTime? expiresAt, CancellationToken ct)
    {
        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Id == orgId, ct);
        if (org == null) return;
        org.SubscriptionStatus = status;
        if (!string.IsNullOrWhiteSpace(plan)) org.Plan = plan;
        org.SubscriptionExpiresAt = expiresAt;
        if (org.SubscriptionActivatedAt == null && status == "Active")
            org.SubscriptionActivatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private async Task ActivateOrgAsync(Guid orgId, string plan, CancellationToken ct)
    {
        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Id == orgId, ct);
        if (org == null) return;
        org.Plan = plan;
        org.SubscriptionStatus = "Active";
        org.SubscriptionActivatedAt = DateTime.UtcNow;
        org.SubscriptionExpiresAt = null;
        await db.SaveChangesAsync(ct);
    }

    private async Task SuspendOrgAsync(Guid orgId, CancellationToken ct)
    {
        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Id == orgId, ct);
        if (org == null) return;
        org.SubscriptionStatus = "Suspended";
        await db.SaveChangesAsync(ct);
    }
}
