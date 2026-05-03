using Simulyn.Api.Data;
using Simulyn.Api.Models.Entities;

namespace Simulyn.Api.Services;

/// <summary>
/// Seeds realistic construction projects so a brand-new user can see the product
/// working with varied data. Multiple scenarios available so the same demo
/// account can show "healthy", "in trouble", "just started" and "near complete"
/// projects side-by-side.
/// </summary>
public class SampleProjectService(AppDbContext db, PredictionService predictions)
{
    public enum SampleScenario
    {
        /// <summary>12 tasks, half-complete tower, mixed risk. The default.</summary>
        Mixed,
        /// <summary>12 tasks, mostly on track, almost no high-risk items.</summary>
        Healthy,
        /// <summary>14 tasks, several seriously behind schedule, lots of red.</summary>
        Trouble,
        /// <summary>15 tasks, project just kicked off, most at 0% progress.</summary>
        JustStarted,
        /// <summary>13 tasks, project at handover stage, mostly 100%.</summary>
        NearComplete,
    }

    private record SampleTask(string Name, int StartOffsetDays, int DurationDays, int Progress);

    private record ProjectSpec(
        string Name,
        int ProjectStartOffsetDays,
        int ProjectDurationDays,
        IReadOnlyList<SampleTask> Tasks);

    public async Task<Project> CreateAndPredictAsync(
        Guid organizationId,
        Guid createdByUserId,
        SampleScenario scenario = SampleScenario.Mixed,
        CancellationToken ct = default)
    {
        var spec = GetScenarioSpec(scenario);
        var project = BuildProject(organizationId, createdByUserId, spec);

        db.Projects.Add(project);
        await db.SaveChangesAsync(ct);

        await predictions.RunForProjectAsync(project.Id, organizationId, ct);
        return project;
    }

    /// <summary>
    /// Creates four projects representing different real-world scenarios
    /// (Healthy, Trouble, JustStarted, NearComplete) and runs predictions on
    /// each. Useful for first-time demos and for testing multi-project workflows.
    /// Sequential to avoid hammering Ollama / OpenAI with too many parallel calls.
    /// </summary>
    public async Task<List<Project>> CreateDemoBundleAsync(
        Guid organizationId,
        Guid createdByUserId,
        CancellationToken ct = default)
    {
        var scenarios = new[]
        {
            SampleScenario.Healthy,
            SampleScenario.Trouble,
            SampleScenario.JustStarted,
            SampleScenario.NearComplete,
        };

        var created = new List<Project>(scenarios.Length);
        foreach (var scenario in scenarios)
        {
            var project = await CreateAndPredictAsync(organizationId, createdByUserId, scenario, ct);
            created.Add(project);
        }
        return created;
    }

    private static Project BuildProject(Guid organizationId, Guid createdByUserId, ProjectSpec spec)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var projectStart = today.AddDays(spec.ProjectStartOffsetDays);
        var projectEnd = projectStart.AddDays(spec.ProjectDurationDays);

        var project = new Project
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            CreatedByUserId = createdByUserId,
            Name = spec.Name,
            StartDate = projectStart,
            EndDate = projectEnd,
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
        };

        foreach (var s in spec.Tasks)
        {
            var taskStart = projectStart.AddDays(s.StartOffsetDays);
            var taskEnd = taskStart.AddDays(s.DurationDays);
            project.Tasks.Add(new ProjectTask
            {
                Id = Guid.NewGuid(),
                ProjectId = project.Id,
                Name = s.Name,
                StartDate = taskStart,
                EndDate = taskEnd,
                Progress = s.Progress,
                Status = s.Progress >= 100 ? "Done" : "InProgress",
                CreatedAt = DateTime.UtcNow,
            });
        }
        return project;
    }

    private static ProjectSpec GetScenarioSpec(SampleScenario scenario) => scenario switch
    {
        SampleScenario.Mixed => MixedTowerSpec(),
        SampleScenario.Healthy => HealthyTowerSpec(),
        SampleScenario.Trouble => TroubleMetroSpec(),
        SampleScenario.JustStarted => JustStartedVillasSpec(),
        SampleScenario.NearComplete => NearCompleteFitoutSpec(),
        _ => MixedTowerSpec(),
    };

    // Existing default — 6-storey residential tower, ~half complete, mixed risk.
    private static ProjectSpec MixedTowerSpec() => new(
        Name: $"Demo · 6-storey residential tower ({DateTime.UtcNow:yyyy-MM-dd})",
        ProjectStartOffsetDays: -60,
        ProjectDurationDays: 180,
        Tasks: new[]
        {
            new SampleTask("Site mobilisation & hoarding",            0,   10, 100),
            new SampleTask("Excavation & shoring",                    8,   18,  95),
            new SampleTask("Pile cap & raft foundation",             20,   25,  80),
            new SampleTask("Basement RCC structure",                 40,   35,  60),
            new SampleTask("Ground floor RCC slab",                  70,   18,  35),
            new SampleTask("Level 1-3 RCC structure",                85,   30,  20),
            new SampleTask("MEP rough-in (basement & ground)",       60,   30,  15),
            new SampleTask("External brickwork & blockwork",         95,   28,  10),
            new SampleTask("Internal plaster (lower floors)",       110,   25,   0),
            new SampleTask("Aluminium glazing & facade",            130,   28,   0),
            new SampleTask("Tiling & flooring (lower floors)",      135,   22,   0),
            new SampleTask("Final fitout & handover snagging",      155,   20,   0),
        });

    // Healthy commercial tower — most tasks on or ahead of schedule.
    // Designed to show "Low" risk dominating the dashboard.
    private static ProjectSpec HealthyTowerSpec() => new(
        Name: "Demo · Riverside Heights — 12-storey office (on track)",
        ProjectStartOffsetDays: -75,
        ProjectDurationDays: 220,
        Tasks: new[]
        {
            new SampleTask("Site mobilisation & temporary services",    0,   12, 100),
            new SampleTask("Bulk excavation & shoring",                10,   20, 100),
            new SampleTask("Pile cap & raft pour",                     25,   22, 100),
            new SampleTask("Basement structure & waterproofing",       45,   30,  95),
            new SampleTask("Ground floor structure",                   70,   18,  90),
            new SampleTask("Level 1-4 RCC structure",                  85,   35,  70),
            new SampleTask("Tower crane operations & safety review",   60,   90,  55),
            new SampleTask("MEP rough-in (basement to L4)",           100,   45,  35),
            new SampleTask("Curtain wall procurement & mockup",       120,   30,  25),
            new SampleTask("Lift shaft installation",                 140,   40,  10),
            new SampleTask("Roof slab & parapet",                     165,   18,   0),
            new SampleTask("Internal fitout & MEP commissioning",     180,   35,   0),
        });

    // Project clearly behind — designed to surface lots of "High" risk insights.
    // Several tasks with low progress and deadlines already past or imminent.
    private static ProjectSpec TroubleMetroSpec() => new(
        Name: "Demo · Metro Line 7 extension (behind schedule)",
        ProjectStartOffsetDays: -210,
        ProjectDurationDays: 270,
        Tasks: new[]
        {
            new SampleTask("ROW acquisition & utility relocation",      0,   45,  85),
            new SampleTask("Tunnel boring machine launch shaft",       30,   60,  70),
            new SampleTask("TBM drive — segment 1 (1.2 km)",           80,   90,  40),
            new SampleTask("TBM drive — segment 2 (1.0 km)",          150,   80,  10),
            new SampleTask("Cut-and-cover station box (Station A)",    50,  100,  35),
            new SampleTask("Cut-and-cover station box (Station B)",    90,  110,  20),
            new SampleTask("Track-bed concreting & rail installation", 170,   60,   0),
            new SampleTask("Third-rail traction power",                190,   55,   0),
            new SampleTask("Signalling & communications cabling",      200,   50,   0),
            new SampleTask("Station finishes & MEP",                   210,   40,   0),
            new SampleTask("Rolling stock acceptance trials",          230,   30,   0),
            new SampleTask("System integration testing",               240,   25,   0),
            new SampleTask("Trial running & safety case",              250,   15,   0),
            new SampleTask("Statutory inspections & opening",          262,    8,   0),
        });

    // Project that just started — most tasks 0%, only first few have progress.
    // Useful for testing "what does the dashboard look like for a brand new project?"
    private static ProjectSpec JustStartedVillasSpec() => new(
        Name: "Demo · Pinewood Villas — 24-unit community (kickoff)",
        ProjectStartOffsetDays: -10,
        ProjectDurationDays: 300,
        Tasks: new[]
        {
            new SampleTask("Site survey & soil testing",                0,    8, 100),
            new SampleTask("Site clearance & grading",                  6,   12,  60),
            new SampleTask("Temporary site office & utilities",        10,    7,  40),
            new SampleTask("Boundary wall & access road",              15,   25,  10),
            new SampleTask("Block A — foundations (units 1-6)",        25,   30,   0),
            new SampleTask("Block B — foundations (units 7-12)",       40,   30,   0),
            new SampleTask("Block C — foundations (units 13-18)",      55,   30,   0),
            new SampleTask("Block D — foundations (units 19-24)",      70,   30,   0),
            new SampleTask("Block A — superstructure",                 60,   60,   0),
            new SampleTask("Block B — superstructure",                 80,   60,   0),
            new SampleTask("Common areas — clubhouse & pool",         150,   80,   0),
            new SampleTask("MEP rough-in (all blocks)",               140,   90,   0),
            new SampleTask("External works — landscaping & roads",    220,   55,   0),
            new SampleTask("Final fit-out & snagging",                250,   35,   0),
            new SampleTask("Handover & customer walk-throughs",       285,   12,   0),
        });

    // Project nearly finished — most tasks 100%, finishing-trade work in progress.
    // Useful for testing the "we're almost done" scenario.
    private static ProjectSpec NearCompleteFitoutSpec() => new(
        Name: "Demo · Tech Park Phase 2 — interior fitout (handover)",
        ProjectStartOffsetDays: -150,
        ProjectDurationDays: 175,
        Tasks: new[]
        {
            new SampleTask("Demolition of existing fitout",             0,   10, 100),
            new SampleTask("Structural alterations & openings",         8,   14, 100),
            new SampleTask("MEP first-fix",                            18,   25, 100),
            new SampleTask("Drywall & ceiling grid",                   38,   20, 100),
            new SampleTask("Joinery & built-in cabinetry",             55,   25, 100),
            new SampleTask("Flooring (carpet tile + LVT)",             75,   20,  95),
            new SampleTask("Painting & decorative finishes",           90,   18,  90),
            new SampleTask("MEP second-fix & terminations",           100,   22,  85),
            new SampleTask("Furniture installation",                  120,   15,  60),
            new SampleTask("AV & low-voltage systems commissioning",  130,   18,  40),
            new SampleTask("Snagging & punch list",                   145,   18,  20),
            new SampleTask("Cleaning & flush-out",                    158,   10,  10),
            new SampleTask("Client walk-through & handover",          168,    7,   0),
        });
}
