using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Dtos;

namespace Simulyn.Api.Services;

/// <summary>
/// Tool registry for the chat copilot. Each tool is a read-only function the LLM
/// can call to fetch real org data. All queries are scoped by orgId — the LLM
/// cannot leak across organizations even if it tries.
///
/// Tools return small JSON payloads (~&lt; 3 KB) so the LLM context stays tight.
/// Long lists are truncated with a "_note" field telling the LLM more rows exist.
/// </summary>
public class ChatTools(AppDbContext db, BillingService billing)
{
    private const int MaxRowsInList = 25;

    /// <summary>
    /// Public schema list shipped to the LLM in every chat-step request. Keep
    /// descriptions concrete and parameter docs short — the LLM uses them to
    /// decide which tool to call.
    /// </summary>
    public static IReadOnlyList<ChatToolDefinitionDto> Definitions { get; } = BuildDefinitions();

    public async Task<JsonNode?> ExecuteAsync(
        string name,
        JsonObject? arguments,
        Guid orgId,
        Guid userId,
        CancellationToken ct)
    {
        arguments ??= new JsonObject();
        return name switch
        {
            "list_projects" => await ListProjects(orgId, ct),
            "get_project" => await GetProject(arguments, orgId, ct),
            "list_at_risk_tasks" => await ListAtRiskTasks(arguments, orgId, ct),
            "get_task" => await GetTask(arguments, orgId, ct),
            "list_recent_alerts" => await ListRecentAlerts(arguments, orgId, ct),
            "get_dashboard_summary" => await GetDashboardSummary(orgId, ct),
            "get_risk_trend" => await GetRiskTrend(arguments, orgId, ct),
            "list_organizations" => await ListOrganizations(userId, ct),
            "list_org_members" => await ListOrgMembers(arguments, orgId, userId, ct),
            "get_recent_predictions" => await GetRecentPredictions(arguments, orgId, ct),
            _ => JsonValue.Create(new { error = $"Unknown tool '{name}'." })!,
        };
    }

    // ---------------- Implementations ----------------

    private async Task<JsonNode> ListProjects(Guid orgId, CancellationToken ct)
    {
        var projects = await db.Projects.AsNoTracking()
            .Where(p => p.OrganizationId == orgId)
            .Include(p => p.Tasks).ThenInclude(t => t.Predictions)
            .OrderBy(p => p.Name)
            .ToListAsync(ct);

        var rows = projects.Select(p =>
        {
            var (high, medium, low, unpredicted) = SummarizeRisks(p.Tasks);
            var avgProgress = p.Tasks.Count == 0 ? 0 : (int)Math.Round(p.Tasks.Average(t => t.Progress));
            return new
            {
                id = p.Id.ToString(),
                name = p.Name,
                status = p.Status,
                start_date = p.StartDate.ToString("yyyy-MM-dd"),
                end_date = p.EndDate.ToString("yyyy-MM-dd"),
                task_count = p.Tasks.Count,
                avg_progress_pct = avgProgress,
                high_risk_tasks = high,
                medium_risk_tasks = medium,
                low_risk_tasks = low,
                unpredicted_tasks = unpredicted,
            };
        }).ToList();

        return Wrap(new
        {
            count = rows.Count,
            projects = rows.Take(MaxRowsInList),
            message = rows.Count == 0
                ? "This organization has no projects yet."
                : null,
            _note = rows.Count > MaxRowsInList
                ? $"Truncated to {MaxRowsInList} of {rows.Count} projects."
                : null,
        });
    }

    private async Task<JsonNode> GetProject(JsonObject args, Guid orgId, CancellationToken ct)
    {
        var key = args["project_id_or_name"]?.ToString();
        if (string.IsNullOrWhiteSpace(key))
            return Wrap(new { error = "Missing required argument: project_id_or_name." });

        var project = await ResolveProject(key, orgId, ct);
        if (project == null) return Wrap(new { error = $"No project matched '{key}' in this organization." });

        var (high, medium, low, unpredicted) = SummarizeRisks(project.Tasks);
        var avgProgress = project.Tasks.Count == 0
            ? 0 : (int)Math.Round(project.Tasks.Average(t => t.Progress));
        var entitled = await billing.IsEntitledAsync(orgId, ct);

        return Wrap(new
        {
            id = project.Id.ToString(),
            name = project.Name,
            status = project.Status,
            start_date = project.StartDate.ToString("yyyy-MM-dd"),
            end_date = project.EndDate.ToString("yyyy-MM-dd"),
            task_count = project.Tasks.Count,
            avg_progress_pct = avgProgress,
            high_risk_tasks = high,
            medium_risk_tasks = medium,
            low_risk_tasks = low,
            unpredicted_tasks = unpredicted,
            ai_entitled = entitled,
        });
    }

    private async Task<JsonNode> ListAtRiskTasks(JsonObject args, Guid orgId, CancellationToken ct)
    {
        var key = args["project_id_or_name"]?.ToString();
        var levelFilter = args["level"]?.ToString();
        var requested = (int?)args["limit"] ?? 15;
        var limit = Math.Clamp(requested, 1, MaxRowsInList);

        IQueryable<Models.Entities.ProjectTask> query = db.Tasks.AsNoTracking()
            .Include(t => t.Project)
            .Include(t => t.Predictions)
            .Where(t => t.Project.OrganizationId == orgId);

        if (!string.IsNullOrWhiteSpace(key))
        {
            var project = await ResolveProject(key, orgId, ct);
            if (project == null) return Wrap(new { error = $"No project matched '{key}'." });
            query = query.Where(t => t.ProjectId == project.Id);
        }

        var tasks = await query.ToListAsync(ct);

        var ordered = tasks
            .Select(t =>
            {
                var last = t.Predictions.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
                return (Task: t, Last: last);
            })
            .Where(x =>
            {
                if (x.Last == null) return false;
                if (string.IsNullOrWhiteSpace(levelFilter))
                    return x.Last.RiskLevel is "High" or "Medium";
                return string.Equals(x.Last.RiskLevel, levelFilter, StringComparison.OrdinalIgnoreCase);
            })
            .OrderBy(x => RiskRank(x.Last!.RiskLevel))
            .ThenByDescending(x => x.Last!.DelayDays)
            .Take(limit)
            .Select(x => new
            {
                task_id = x.Task.Id.ToString(),
                task_name = x.Task.Name,
                project_id = x.Task.ProjectId.ToString(),
                project_name = x.Task.Project.Name,
                risk_level = x.Last!.RiskLevel,
                delay_days = x.Last.DelayDays,
                progress_pct = x.Task.Progress,
                start_date = x.Task.StartDate.ToString("yyyy-MM-dd"),
                end_date = x.Task.EndDate.ToString("yyyy-MM-dd"),
                summary = x.Last.Summary,
            })
            .ToList();

        return Wrap(new
        {
            count = ordered.Count,
            tasks = ordered,
            message = ordered.Count == 0
                ? (string.IsNullOrWhiteSpace(key)
                    ? "No at-risk tasks found in this organization. Either no tasks exist yet, or none have been run through 'Run prediction' yet. Suggest the user open a project and click 'Run prediction (all tasks)'."
                    : "No at-risk tasks found in that project. It may have no tasks yet, or none have been run through 'Run prediction' yet.")
                : null,
        });
    }

    private async Task<JsonNode> GetTask(JsonObject args, Guid orgId, CancellationToken ct)
    {
        if (!Guid.TryParse(args["task_id"]?.ToString(), out var taskId))
            return Wrap(new { error = "Missing or invalid task_id (must be a GUID)." });

        var task = await db.Tasks.AsNoTracking()
            .Include(t => t.Project)
            .Include(t => t.Predictions)
            .FirstOrDefaultAsync(t => t.Id == taskId && t.Project.OrganizationId == orgId, ct);
        if (task == null) return Wrap(new { error = "Task not found in this organization." });

        var last = task.Predictions.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
        return Wrap(new
        {
            task_id = task.Id.ToString(),
            task_name = task.Name,
            project_id = task.ProjectId.ToString(),
            project_name = task.Project.Name,
            start_date = task.StartDate.ToString("yyyy-MM-dd"),
            end_date = task.EndDate.ToString("yyyy-MM-dd"),
            progress_pct = task.Progress,
            status = task.Status,
            latest_prediction = last == null ? null : new
            {
                risk_level = last.RiskLevel,
                delay_days = last.DelayDays,
                summary = last.Summary,
                recommendation = last.Recommendation,
                created_at = last.CreatedAt.ToString("o"),
            },
        });
    }

    private async Task<JsonNode> ListRecentAlerts(JsonObject args, Guid orgId, CancellationToken ct)
    {
        var requested = (int?)args["limit"] ?? 10;
        var limit = Math.Clamp(requested, 1, MaxRowsInList);

        var projectIds = await db.Projects
            .Where(p => p.OrganizationId == orgId)
            .Select(p => p.Id)
            .ToListAsync(ct);

        var tasks = await db.Tasks.AsNoTracking()
            .Where(t => projectIds.Contains(t.ProjectId))
            .Include(t => t.Project)
            .Include(t => t.Predictions)
            .ToListAsync(ct);

        var alerts = new List<object>();
        foreach (var t in tasks)
        {
            var last = t.Predictions.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
            if (last == null) continue;
            if (last.RiskLevel is not ("High" or "Medium")) continue;
            alerts.Add(new
            {
                task_id = t.Id.ToString(),
                task_name = t.Name,
                project_id = t.ProjectId.ToString(),
                project_name = t.Project.Name,
                risk_level = last.RiskLevel,
                delay_days = last.DelayDays,
                summary = last.Summary,
                created_at = last.CreatedAt.ToString("o"),
            });
        }

        var sorted = alerts
            .OrderByDescending(a => ((dynamic)a).created_at)
            .Take(limit)
            .ToList();
        return Wrap(new
        {
            count = sorted.Count,
            alerts = sorted,
            message = sorted.Count == 0
                ? "No recent High/Medium risk alerts in this organization. If the user expected alerts, suggest they open a project and click 'Run prediction (all tasks)'."
                : null,
        });
    }

    private async Task<JsonNode> GetDashboardSummary(Guid orgId, CancellationToken ct)
    {
        var projectIds = await db.Projects
            .Where(p => p.OrganizationId == orgId)
            .Select(p => p.Id)
            .ToListAsync(ct);

        var tasks = await db.Tasks.AsNoTracking()
            .Where(t => projectIds.Contains(t.ProjectId))
            .Include(t => t.Predictions)
            .ToListAsync(ct);

        var (high, medium, low, unpredicted) = SummarizeRisks(tasks);
        return Wrap(new
        {
            total_projects = projectIds.Count,
            total_tasks = tasks.Count,
            high_risk_tasks = high,
            medium_risk_tasks = medium,
            low_risk_tasks = low,
            unpredicted_tasks = unpredicted,
            open_alerts = high + medium,
        });
    }

    private async Task<JsonNode> GetRiskTrend(JsonObject args, Guid orgId, CancellationToken ct)
    {
        var requested = (int?)args["days"] ?? 14;
        var days = Math.Clamp(requested, 1, 30);

        var projectIds = await db.Projects
            .Where(p => p.OrganizationId == orgId)
            .Select(p => p.Id)
            .ToListAsync(ct);

        var tasks = await db.Tasks.AsNoTracking()
            .Where(t => projectIds.Contains(t.ProjectId))
            .Include(t => t.Predictions)
            .ToListAsync(ct);

        var today = DateTime.UtcNow.Date;
        var points = new List<object>(days);
        for (var i = days - 1; i >= 0; i--)
        {
            var day = today.AddDays(-i);
            var endOfDay = day.AddDays(1);
            var high = 0; var medium = 0; var low = 0;
            foreach (var t in tasks)
            {
                var last = t.Predictions
                    .Where(p => p.CreatedAt < endOfDay)
                    .OrderByDescending(p => p.CreatedAt)
                    .FirstOrDefault();
                if (last == null) continue;
                switch (last.RiskLevel)
                {
                    case "High": high++; break;
                    case "Medium": medium++; break;
                    case "Low": low++; break;
                }
            }
            points.Add(new
            {
                date = day.ToString("yyyy-MM-dd"),
                high_risk_tasks = high,
                medium_risk_tasks = medium,
                low_risk_tasks = low,
            });
        }

        return Wrap(new { days, points });
    }

    private async Task<JsonNode> ListOrganizations(Guid userId, CancellationToken ct)
    {
        var memberships = await db.OrganizationMembers.AsNoTracking()
            .Include(m => m.Organization)
            .Where(m => m.UserId == userId)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(ct);

        var rows = memberships.Select(m => new
        {
            id = m.OrganizationId.ToString(),
            name = m.Organization.Name,
            my_role = m.Role,
            plan = m.Organization.Plan,
            subscription_status = m.Organization.SubscriptionStatus,
        }).ToList();

        return Wrap(new { count = rows.Count, organizations = rows });
    }

    private async Task<JsonNode> ListOrgMembers(JsonObject args, Guid orgId, Guid userId, CancellationToken ct)
    {
        var requestedOrgId = orgId;
        if (Guid.TryParse(args["org_id"]?.ToString(), out var explicitOrgId))
            requestedOrgId = explicitOrgId;

        var iAmMember = await db.OrganizationMembers.AsNoTracking()
            .AnyAsync(m => m.OrganizationId == requestedOrgId && m.UserId == userId, ct);
        if (!iAmMember)
            return Wrap(new { error = "You are not a member of that organization." });

        var members = await db.OrganizationMembers.AsNoTracking()
            .Include(m => m.User)
            .Where(m => m.OrganizationId == requestedOrgId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new
            {
                user_id = m.UserId.ToString(),
                name = m.User.Name,
                email = m.User.Email,
                role = m.Role,
                joined_at = m.CreatedAt.ToString("o"),
            })
            .ToListAsync(ct);

        return Wrap(new { count = members.Count, members });
    }

    private async Task<JsonNode> GetRecentPredictions(JsonObject args, Guid orgId, CancellationToken ct)
    {
        if (!Guid.TryParse(args["task_id"]?.ToString(), out var taskId))
            return Wrap(new { error = "Missing or invalid task_id." });
        var requested = (int?)args["limit"] ?? 5;
        var limit = Math.Clamp(requested, 1, 20);

        var task = await db.Tasks.AsNoTracking()
            .Include(t => t.Project)
            .FirstOrDefaultAsync(t => t.Id == taskId && t.Project.OrganizationId == orgId, ct);
        if (task == null) return Wrap(new { error = "Task not found in this organization." });

        var preds = await db.Predictions.AsNoTracking()
            .Where(p => p.TaskId == taskId)
            .OrderByDescending(p => p.CreatedAt)
            .Take(limit)
            .Select(p => new
            {
                id = p.Id.ToString(),
                risk_level = p.RiskLevel,
                delay_days = p.DelayDays,
                summary = p.Summary,
                created_at = p.CreatedAt.ToString("o"),
            })
            .ToListAsync(ct);

        return Wrap(new
        {
            task_id = taskId.ToString(),
            task_name = task.Name,
            count = preds.Count,
            predictions = preds,
        });
    }

    // ---------------- Helpers ----------------

    private async Task<Models.Entities.Project?> ResolveProject(string key, Guid orgId, CancellationToken ct)
    {
        // Accept either a GUID or a (case-insensitive contains) name match.
        if (Guid.TryParse(key, out var asGuid))
        {
            return await db.Projects.AsNoTracking()
                .Include(p => p.Tasks).ThenInclude(t => t.Predictions)
                .FirstOrDefaultAsync(p => p.Id == asGuid && p.OrganizationId == orgId, ct);
        }
        var trimmed = key.Trim();
        var lower = trimmed.ToLowerInvariant();
        var candidates = await db.Projects.AsNoTracking()
            .Include(p => p.Tasks).ThenInclude(t => t.Predictions)
            .Where(p => p.OrganizationId == orgId && p.Name.ToLower().Contains(lower))
            .ToListAsync(ct);
        // Prefer exact (case-insensitive) match if multiple candidates contain the substring.
        return candidates.FirstOrDefault(p =>
                   string.Equals(p.Name, trimmed, StringComparison.OrdinalIgnoreCase))
               ?? candidates.FirstOrDefault();
    }

    private static (int High, int Medium, int Low, int Unpredicted) SummarizeRisks(
        IEnumerable<Models.Entities.ProjectTask> tasks)
    {
        var high = 0; var medium = 0; var low = 0; var unpredicted = 0;
        foreach (var t in tasks)
        {
            var last = t.Predictions.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
            if (last == null) { unpredicted++; continue; }
            switch (last.RiskLevel)
            {
                case "High": high++; break;
                case "Medium": medium++; break;
                case "Low": low++; break;
            }
        }
        return (high, medium, low, unpredicted);
    }

    private static int RiskRank(string r) =>
        r switch { "High" => 0, "Medium" => 1, _ => 2 };

    private static JsonNode Wrap(object payload)
    {
        var json = JsonSerializer.Serialize(payload);
        return JsonNode.Parse(json)!;
    }

    // ---------------- Tool schemas ----------------

    private static IReadOnlyList<ChatToolDefinitionDto> BuildDefinitions()
    {
        const string EmptyParams = @"{""type"":""object"",""properties"":{},""required"":[]}";

        return new[]
        {
            Tool("list_projects",
                "List all projects in the active organization with progress + risk roll-up. " +
                "Call this first when the user asks something like 'what are my projects' or " +
                "needs to find a project by partial name.",
                EmptyParams),

            Tool("get_project",
                "Get a single project's details (status, dates, task counts, risk roll-up) " +
                "by id or by name. Name match is case-insensitive substring; prefer this over " +
                "list_projects when the user names the project.",
                @"{
                    ""type"": ""object"",
                    ""properties"": {
                      ""project_id_or_name"": { ""type"": ""string"", ""description"": ""Project GUID or name (substring ok)"" }
                    },
                    ""required"": [""project_id_or_name""]
                  }"),

            Tool("list_at_risk_tasks",
                "List tasks whose latest AI prediction is risky. Default level filter is " +
                "High+Medium. Optional project_id_or_name narrows to one project.",
                @"{
                    ""type"": ""object"",
                    ""properties"": {
                      ""project_id_or_name"": { ""type"": ""string"", ""description"": ""Optional. Project GUID or name."" },
                      ""level"": { ""type"": ""string"", ""enum"": [""High"", ""Medium"", ""Low""], ""description"": ""Optional risk level filter."" },
                      ""limit"": { ""type"": ""integer"", ""description"": ""Max rows (default 15, cap 25)."" }
                    },
                    ""required"": []
                  }"),

            Tool("get_task",
                "Get one task's full details including its latest AI prediction summary and recommendation.",
                @"{
                    ""type"": ""object"",
                    ""properties"": {
                      ""task_id"": { ""type"": ""string"", ""description"": ""Task GUID."" }
                    },
                    ""required"": [""task_id""]
                  }"),

            Tool("list_recent_alerts",
                "List recent High/Medium risk alerts across the org, newest first.",
                @"{
                    ""type"": ""object"",
                    ""properties"": {
                      ""limit"": { ""type"": ""integer"", ""description"": ""Max alerts (default 10, cap 25)."" }
                    },
                    ""required"": []
                  }"),

            Tool("get_dashboard_summary",
                "Org-wide KPI counts: total projects, total tasks, risk counts, open alerts. " +
                "Good first call for portfolio-level questions.",
                EmptyParams),

            Tool("get_risk_trend",
                "Daily count of High/Medium/Low risk tasks across the org for the last N days.",
                @"{
                    ""type"": ""object"",
                    ""properties"": {
                      ""days"": { ""type"": ""integer"", ""description"": ""Window in days (default 14, cap 30)."" }
                    },
                    ""required"": []
                  }"),

            Tool("list_organizations",
                "List the organizations the current user is a member of.",
                EmptyParams),

            Tool("list_org_members",
                "List members of an organization with their roles. Defaults to the active org.",
                @"{
                    ""type"": ""object"",
                    ""properties"": {
                      ""org_id"": { ""type"": ""string"", ""description"": ""Optional. Org GUID; defaults to active org."" }
                    },
                    ""required"": []
                  }"),

            Tool("get_recent_predictions",
                "Get the recent prediction history for one task (chronological view of how risk evolved).",
                @"{
                    ""type"": ""object"",
                    ""properties"": {
                      ""task_id"": { ""type"": ""string"", ""description"": ""Task GUID."" },
                      ""limit"": { ""type"": ""integer"", ""description"": ""Max predictions (default 5, cap 20)."" }
                    },
                    ""required"": [""task_id""]
                  }"),
        };
    }

    private static ChatToolDefinitionDto Tool(string name, string description, string parametersJson) =>
        new(name, description, JsonNode.Parse(parametersJson)!.AsObject());
}
