namespace Simulyn.Api.Models.Entities;

/// <summary>
/// Idempotency record for Stripe webhook delivery. Stripe occasionally retries
/// webhook events (network blips, our side returning 5xx); without this table
/// we'd risk double-applying the same plan upgrade. The unique index on
/// <see cref="EventId"/> turns the second attempt into a no-op (UniqueViolation
/// → caught + ignored in the controller). Rows older than ~30 days can be
/// pruned out-of-band; we keep them for billing audit trails in the meantime.
/// </summary>
public class ProcessedStripeEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>The <c>evt_...</c> id from Stripe. Globally unique.</summary>
    public string EventId { get; set; } = string.Empty;

    /// <summary>The Stripe event type, e.g. <c>checkout.session.completed</c>.</summary>
    public string EventType { get; set; } = string.Empty;

    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}
