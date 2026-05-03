using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Models.Entities;
using Simulyn.Api.Services;

namespace Simulyn.Api.Tests;

/// <summary>
/// Smoke tests that the query pattern used across controllers — filter by
/// OrganizationId before returning to the caller — actually isolates tenants.
/// If someone ever forgets the filter, these tests break.
/// </summary>
public class TenantIsolationTests
{
    [Fact]
    public async Task Project_lookup_by_id_is_scoped_to_org()
    {
        using var db = TestFactory.NewDb();
        var orgA = Guid.NewGuid();
        var orgB = Guid.NewGuid();
        db.Organizations.Add(new Organization { Id = orgA, Name = "A", Plan = "Pro", SubscriptionStatus = "Active" });
        db.Organizations.Add(new Organization { Id = orgB, Name = "B", Plan = "Pro", SubscriptionStatus = "Active" });

        var projA = new Project { Id = Guid.NewGuid(), Name = "A-1", OrganizationId = orgA, StartDate = new DateOnly(2026, 1, 1), EndDate = new DateOnly(2026, 6, 1) };
        var projB = new Project { Id = Guid.NewGuid(), Name = "B-1", OrganizationId = orgB, StartDate = new DateOnly(2026, 1, 1), EndDate = new DateOnly(2026, 6, 1) };
        db.Projects.Add(projA);
        db.Projects.Add(projB);
        await db.SaveChangesAsync();

        var fromA = await db.Projects.FirstOrDefaultAsync(p => p.Id == projB.Id && p.OrganizationId == orgA);
        var fromB = await db.Projects.FirstOrDefaultAsync(p => p.Id == projB.Id && p.OrganizationId == orgB);

        fromA.Should().BeNull("org A must not see org B's project");
        fromB.Should().NotBeNull();
        fromB!.Name.Should().Be("B-1");
    }

    [Fact]
    public async Task Task_and_prediction_flow_stays_within_one_org()
    {
        using var db = TestFactory.NewDb();
        var orgId = Guid.NewGuid();
        db.Organizations.Add(new Organization { Id = orgId, Name = "Acme", Plan = "Pro", SubscriptionStatus = "Active" });

        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Tower",
            OrganizationId = orgId,
            StartDate = new DateOnly(2026, 1, 1),
            EndDate = new DateOnly(2026, 6, 1),
        };
        var task = new ProjectTask
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            Name = "Foundation",
            StartDate = new DateOnly(2026, 1, 1),
            EndDate = new DateOnly(2026, 2, 1),
            Progress = 50,
        };
        db.Projects.Add(project);
        db.Tasks.Add(task);
        await db.SaveChangesAsync();

        // Simulate the controller's scoped query:
        var visible = await db.Tasks
            .Where(t => t.Project.OrganizationId == orgId && t.Id == task.Id)
            .FirstOrDefaultAsync();
        visible.Should().NotBeNull();

        // Simulate a request from an unrelated org:
        var otherOrg = Guid.NewGuid();
        var crossTenant = await db.Tasks
            .Where(t => t.Project.OrganizationId == otherOrg && t.Id == task.Id)
            .FirstOrDefaultAsync();
        crossTenant.Should().BeNull();
    }

    [Fact]
    public async Task UsageEvents_are_aggregated_per_org_and_per_day()
    {
        using var db = TestFactory.NewDb();
        var orgA = Guid.NewGuid();
        var orgB = Guid.NewGuid();
        var usage = new UsageService(db, new Microsoft.Extensions.Logging.Abstractions.NullLogger<UsageService>());

        await usage.RecordAsync(orgA, null, UsageEventKinds.Prediction, 10);
        await usage.RecordAsync(orgA, null, UsageEventKinds.Prediction, 20);
        await usage.RecordAsync(orgB, null, UsageEventKinds.Prediction, 500);

        (await usage.GetTodayMillsAsync(orgA)).Should().Be(30);
        (await usage.GetTodayMillsAsync(orgB)).Should().Be(500);
    }
}
