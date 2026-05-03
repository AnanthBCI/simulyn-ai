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
}
