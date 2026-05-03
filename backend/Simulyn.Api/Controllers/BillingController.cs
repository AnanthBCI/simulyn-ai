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
        return Ok(new { received = true });
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
