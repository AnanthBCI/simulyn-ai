using FluentAssertions;
using Simulyn.Api.Models.Entities;
using Simulyn.Api.Services;

namespace Simulyn.Api.Tests;

public class BillingServiceTests
{
    [Fact]
    public async Task Entitled_when_plan_is_active()
    {
        using var db = TestFactory.NewDb();
        var orgId = Guid.NewGuid();
        db.Organizations.Add(new Organization
        {
            Id = orgId,
            Name = "Acme",
            Plan = "Pro",
            SubscriptionStatus = "Active",
            SubscriptionExpiresAt = null,
            SubscriptionActivatedAt = DateTime.UtcNow.AddDays(-10),
        });
        await db.SaveChangesAsync();
        var svc = new BillingService(db);

        (await svc.IsEntitledAsync(orgId, CancellationToken.None)).Should().BeTrue();
    }

    [Fact]
    public async Task Entitled_when_trial_not_expired()
    {
        using var db = TestFactory.NewDb();
        var orgId = Guid.NewGuid();
        db.Organizations.Add(new Organization
        {
            Id = orgId,
            Name = "Acme",
            Plan = "Starter",
            SubscriptionStatus = "Trial",
            SubscriptionExpiresAt = DateTime.UtcNow.AddDays(10),
            SubscriptionActivatedAt = DateTime.UtcNow.AddDays(-1),
        });
        await db.SaveChangesAsync();
        var svc = new BillingService(db);

        (await svc.IsEntitledAsync(orgId, CancellationToken.None)).Should().BeTrue();
    }

    [Fact]
    public async Task Not_entitled_when_trial_expired()
    {
        using var db = TestFactory.NewDb();
        var orgId = Guid.NewGuid();
        db.Organizations.Add(new Organization
        {
            Id = orgId,
            Name = "Acme",
            Plan = "Starter",
            SubscriptionStatus = "Trial",
            SubscriptionExpiresAt = DateTime.UtcNow.AddDays(-1),
            SubscriptionActivatedAt = DateTime.UtcNow.AddDays(-31),
        });
        await db.SaveChangesAsync();
        var svc = new BillingService(db);

        (await svc.IsEntitledAsync(orgId, CancellationToken.None)).Should().BeFalse();
    }

    [Fact]
    public async Task Not_entitled_when_status_suspended()
    {
        using var db = TestFactory.NewDb();
        var orgId = Guid.NewGuid();
        db.Organizations.Add(new Organization
        {
            Id = orgId,
            Name = "Acme",
            Plan = "Pro",
            SubscriptionStatus = "Suspended",
            SubscriptionExpiresAt = DateTime.UtcNow.AddDays(10),
        });
        await db.SaveChangesAsync();
        var svc = new BillingService(db);

        (await svc.IsEntitledAsync(orgId, CancellationToken.None)).Should().BeFalse();
    }

    // The static helper is hot-path: OrganizationsController.Mine + AdminBilling
    // call it once per row rendered. These guard against future drift between
    // the static and instance implementations.
    [Theory]
    [InlineData("Active", null, true)]
    [InlineData("Active", -1, false)]   // expired Active subscription
    [InlineData("Active", 30, true)]
    [InlineData("Trial", null, false)]   // trial requires an expiry
    [InlineData("Trial", -1, false)]
    [InlineData("Trial", 1, true)]
    [InlineData("Suspended", 30, false)]
    [InlineData("Inactive", 30, false)]
    [InlineData("", 30, false)]
    [InlineData("Unknown", 30, false)]
    public void Static_IsEntitled_matches_instance_implementation(string status, int? expiresInDays, bool expected)
    {
        DateTime? expires = expiresInDays.HasValue
            ? DateTime.UtcNow.AddDays(expiresInDays.Value)
            : null;
        BillingService.IsEntitled(status, expires).Should().Be(expected);
    }
}
