using System.Text;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Simulyn.Api.Services;

namespace Simulyn.Api.Tests;

/// <summary>
/// Verifies that the Stripe webhook signature check actually rejects bad
/// signatures. This is the only thing standing between us and a malicious
/// caller flipping every org to Active by POSTing a forged payload to
/// /api/billing/webhook — so we treat it as a security regression test.
/// </summary>
public class StripeWebhookSignatureTests
{
    [Fact]
    public void ConstructEvent_throws_when_signature_header_is_missing()
    {
        var svc = NewService("whsec_test_secret_for_unit_tests_only");

        var act = () => svc.ConstructEvent(SamplePayload(), signatureHeader: "");

        act.Should().Throw<Stripe.StripeException>(
            "no signature header means we cannot verify the payload — must reject");
    }

    [Fact]
    public void ConstructEvent_throws_when_signature_is_forged()
    {
        var svc = NewService("whsec_test_secret_for_unit_tests_only");

        var act = () => svc.ConstructEvent(SamplePayload(),
            signatureHeader: "t=1700000000,v1=deadbeef00000000000000000000000000000000000000000000000000000000");

        act.Should().Throw<Stripe.StripeException>("forged v1 signature must be rejected");
    }

    [Fact]
    public void ConstructEvent_throws_when_secret_not_configured()
    {
        var svc = NewService(webhookSecret: "");

        var act = () => svc.ConstructEvent(SamplePayload(), signatureHeader: "t=1,v1=ab");

        act.Should().Throw<InvalidOperationException>(
            "we should fail closed if the webhook secret is missing rather than skip verification");
    }

    [Fact]
    public void IsConfigured_is_true_when_apiKey_set()
    {
        var svc = NewService(apiKey: "sk_test_anything", webhookSecret: "");
        svc.IsConfigured.Should().BeTrue();
    }

    [Fact]
    public void IsConfigured_is_false_when_apiKey_missing()
    {
        var svc = NewService(apiKey: "", webhookSecret: "whsec_x");
        svc.IsConfigured.Should().BeFalse();
    }

    private static StripeBillingService NewService(string webhookSecret = "", string apiKey = "sk_test_anything")
    {
        var opts = Options.Create(new StripeOptions
        {
            ApiKey = apiKey,
            WebhookSecret = webhookSecret,
        });
        return new StripeBillingService(opts, NullLogger<StripeBillingService>.Instance);
    }

    private static string SamplePayload() => Encoding.UTF8.GetString(Encoding.UTF8.GetBytes(
        "{\"id\":\"evt_test\",\"object\":\"event\",\"type\":\"checkout.session.completed\",\"data\":{\"object\":{}}}"));
}
