using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;

namespace Simulyn.Api.Services;

public class StripeOptions
{
    public string ApiKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string SuccessUrl { get; set; } = "http://localhost:3000/admin/billing?checkout=success";
    public string CancelUrl { get; set; } = "http://localhost:3000/admin/billing?checkout=cancel";
    /// <summary>Map of plan name → Stripe Price ID (price_...).</summary>
    public Dictionary<string, string> Prices { get; set; } = new();
}

public class StripeBillingService(IOptions<StripeOptions> options, ILogger<StripeBillingService> logger)
{
    public StripeOptions Options => options.Value;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(options.Value.ApiKey);

    /// <summary>Creates a Stripe Checkout session that upgrades an org to a named plan.</summary>
    public async Task<Session> CreateCheckoutSessionAsync(Guid organizationId, string planName, string customerEmail, CancellationToken ct = default)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("Stripe is not configured. Set Stripe:ApiKey.");

        if (!options.Value.Prices.TryGetValue(planName, out var priceId) || string.IsNullOrWhiteSpace(priceId))
            throw new InvalidOperationException($"No Stripe price configured for plan '{planName}'. Set Stripe:Prices:{planName}.");

        var svc = new SessionService();
        var session = await svc.CreateAsync(new SessionCreateOptions
        {
            Mode = "subscription",
            CustomerEmail = customerEmail,
            LineItems = new List<SessionLineItemOptions>
            {
                new() { Price = priceId, Quantity = 1 },
            },
            SuccessUrl = options.Value.SuccessUrl,
            CancelUrl = options.Value.CancelUrl,
            ClientReferenceId = organizationId.ToString(),
            Metadata = new Dictionary<string, string>
            {
                ["organization_id"] = organizationId.ToString(),
                ["plan"] = planName,
            },
            SubscriptionData = new SessionSubscriptionDataOptions
            {
                Metadata = new Dictionary<string, string>
                {
                    ["organization_id"] = organizationId.ToString(),
                    ["plan"] = planName,
                },
            },
        }, cancellationToken: ct);
        logger.LogInformation("Created Stripe checkout session {SessionId} for org {OrgId} plan {Plan}", session.Id, organizationId, planName);
        return session;
    }

    /// <summary>Parses + verifies a Stripe webhook payload.</summary>
    public Event ConstructEvent(string rawJson, string signatureHeader)
    {
        if (string.IsNullOrWhiteSpace(options.Value.WebhookSecret))
            throw new InvalidOperationException("Stripe webhook secret is not configured.");
        return EventUtility.ConstructEvent(rawJson, signatureHeader, options.Value.WebhookSecret);
    }
}
