using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using QuestPDF.Infrastructure;
using Serilog;
using Serilog.Formatting.Compact;
using Simulyn.Api.Data;
using Simulyn.Api.Services;

// QuestPDF community license — free for companies < $1M revenue.
QuestPDF.Settings.License = LicenseType.Community;

// Structured JSON logs for container environments. Compact JSON is picked up
// correctly by Render, Railway, Azure App Service, Datadog, Loki, etc.
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft.AspNetCore", Serilog.Events.LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", Serilog.Events.LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(new CompactJsonFormatter())
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

// Sentry: DSN-driven. No DSN = nothing sent, no errors. Free tier is enough
// for a pilot; bump sample rates before paid tiers.
var sentryDsn = builder.Configuration["Sentry:Dsn"];
if (!string.IsNullOrWhiteSpace(sentryDsn))
{
    builder.WebHost.UseSentry(o =>
    {
        o.Dsn = sentryDsn;
        o.TracesSampleRate = 0.1;
        o.SendDefaultPii = false;
        o.MinimumEventLevel = Microsoft.Extensions.Logging.LogLevel.Warning;
        o.Environment = builder.Environment.EnvironmentName;
    });
}

builder.Services.Configure<FormOptions>(o => { o.MultipartBodyLengthLimit = 20 * 1024 * 1024; });
builder.WebHost.ConfigureKestrel(o => { o.Limits.MaxRequestBodySize = 20 * 1024 * 1024; });

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Simulyn API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Bearer token",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var conn = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(conn))
{
    throw new InvalidOperationException(
        "ConnectionStrings:Default is not configured. Set it via env var ConnectionStrings__Default " +
        "(e.g. 'Host=...;Port=5432;Database=...;Username=...;Password=...;SSL Mode=Require').");
}
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(conn));

builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<JwtService>();
builder.Services.AddScoped<ExcelScheduleImportService>();
builder.Services.AddScoped<BillingService>();
builder.Services.AddScoped<PredictionService>();
builder.Services.AddScoped<SampleProjectService>();
builder.Services.AddScoped<OrganizationContext>();
builder.Services.AddScoped<ChatTools>();
builder.Services.AddScoped<ChatOrchestrator>();
builder.Services.AddScoped<UsageService>();
builder.Services.AddScoped<BudgetGuard>();
builder.Services.AddScoped<AiEntitlement>();
builder.Services.AddScoped<EmailTokenService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<WeeklyRecapPdfService>();
builder.Services.AddScoped<StripeBillingService>();

// Email: pick the sender based on configured provider.
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));
var emailProvider = (builder.Configuration["Email:Provider"] ?? "auto").Trim().ToLowerInvariant();
var hasResendKey = !string.IsNullOrWhiteSpace(builder.Configuration["Email:Resend:ApiKey"]);
if (emailProvider == "resend" || (emailProvider == "auto" && hasResendKey))
{
    builder.Services.AddHttpClient<IEmailSender, ResendEmailSender>();
}
else
{
    builder.Services.AddScoped<IEmailSender, ConsoleEmailSender>();
}

// Stripe: API key wired at call sites via Stripe.StripeConfiguration.ApiKey below.
builder.Services.Configure<StripeOptions>(builder.Configuration.GetSection("Stripe"));

// Background jobs (weekly recap scheduler, notification dispatcher).
builder.Services.AddHostedService<WeeklyRecapScheduler>();

builder.Services.AddHttpClient<AiClientService>((sp, client) =>
{
    var baseUrl = sp.GetRequiredService<IConfiguration>()["AiService:BaseUrl"] ?? "http://localhost:8000";
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
    // Allow enough headroom for an LLM round-trip.
    // Hosted providers (OpenAI/Anthropic): typical ~1-3s, slow tail ~10s.
    // Local Ollama on CPU: typical ~5-15s, slow tail can exceed 30s on first call (model load).
    client.Timeout = TimeSpan.FromSeconds(120);
});

var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32 || jwtKey.StartsWith("CHANGE_ME"))
{
    throw new InvalidOperationException(
        "Jwt:Key is missing, too short (< 32 chars), or set to the placeholder. " +
        "Generate a fresh key per environment: 'openssl rand -base64 48' " +
        "and set it via env var Jwt__Key.");
}
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidAlgorithms = new[] { Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256 },
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });
builder.Services.AddAuthorization();

// Allow comma-separated list in Frontend:Origin (e.g. "https://app.foo.com,https://staging.foo.com").
// Always include localhost 3000 + 3001 for dev (Next.js falls back to 3001 if 3000 is in use).
var configuredOrigins = (builder.Configuration["Frontend:Origin"] ?? string.Empty)
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
var devOrigins = new[]
{
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:3001", "http://127.0.0.1:3001",
};
var allowedOrigins = configuredOrigins.Concat(devOrigins).Distinct().ToArray();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(allowedOrigins)
        .AllowAnyHeader() // includes X-Organization-Id for tenant context
        .AllowAnyMethod()
        .WithExposedHeaders("X-Organization-Id")));

// Brute-force protection on auth endpoints. Per-IP fixed window: 10 requests / minute.
// Chat copilot uses a separate per-user policy so AI calls don't crowd out auth attempts.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true,
            }));

    // Chat copilot: 20 requests / minute / user. Falls back to IP for unauthenticated edges.
    options.AddPolicy("chat", httpContext =>
    {
        var partitionKey = httpContext.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.User?.FindFirst("sub")?.Value
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: partitionKey,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true,
            });
    });

    // Predictions: 60 requests / minute / user. Each call is a per-task LLM round-trip;
    // fires a ~$0.001-0.005 cost on hosted providers. A loose cap, but enough to stop
    // a runaway script from burning a whole day's budget in 30 seconds.
    options.AddPolicy("predictions", httpContext =>
    {
        var partitionKey = httpContext.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.User?.FindFirst("sub")?.Value
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: partitionKey,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true,
            });
    });

    // Simulation: 10 requests / minute / user (compare = up to 8 parallel scenarios
    // per request, so this is the real cost lever).
    options.AddPolicy("simulation", httpContext =>
    {
        var partitionKey = httpContext.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.User?.FindFirst("sub")?.Value
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: partitionKey,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true,
            });
    });
});

var app = builder.Build();

// Auto-apply migrations on startup is convenient locally but a footgun in
// multi-replica prod (race on __EFMigrationsHistory). Default to "yes in
// Development, no otherwise"; flip the env var RunMigrationsOnStartup=true
// to opt in for single-replica deployments (Render free tier, Railway, etc.).
var runMigrations = app.Environment.IsDevelopment()
    || string.Equals(builder.Configuration["RunMigrationsOnStartup"], "true", StringComparison.OrdinalIgnoreCase);
if (runMigrations)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

// Configure Stripe API key from config (empty key = Stripe calls will fail loudly;
// billing endpoints still compile + the rest of the app is unaffected).
var stripeKey = builder.Configuration["Stripe:ApiKey"];
if (!string.IsNullOrWhiteSpace(stripeKey))
{
    Stripe.StripeConfiguration.ApiKey = stripeKey;
}

app.UseSerilogRequestLogging();

// Global exception handler — returns RFC 7807 ProblemDetails with the request
// trace id so a customer screenshot is enough to find the Sentry / Serilog event.
app.UseExceptionHandler(builder => builder.Run(async ctx =>
{
    var feature = ctx.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
    var ex = feature?.Error;
    var traceId = ctx.TraceIdentifier;
    var logger = ctx.RequestServices.GetRequiredService<ILogger<Program>>();
    logger.LogError(ex, "Unhandled exception {TraceId} on {Method} {Path}",
        traceId, ctx.Request.Method, ctx.Request.Path);

    ctx.Response.ContentType = "application/problem+json";
    ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await ctx.Response.WriteAsJsonAsync(new
    {
        type = "https://httpstatuses.com/500",
        title = "An unexpected error occurred.",
        status = 500,
        traceId,
    });
}));

// Swagger only in Development. Pre-pilot we don't want to leak the full schema
// to the open internet — narrows what an attacker has to guess.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
// IMPORTANT: Authentication must run BEFORE the rate limiter so per-user
// policies (chat / predictions / simulation) can read User.NameIdentifier.
// If reordered, authenticated users fall back to per-IP partitioning and two
// users behind a NAT / corporate proxy starve each other.
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// Liveness — process is up. Cheap, no I/O.
app.MapGet("/healthz", () => Results.Ok(new { status = "ok", service = "simulyn.api" }))
    .AllowAnonymous();

// Readiness — dependencies reachable. Used by orchestrators / uptime monitors
// to decide whether to send traffic. Fails (503) if DB or AI service is down.
app.MapGet("/healthz/ready", async (AppDbContext db, AiClientService ai, CancellationToken ct) =>
{
    var checks = new Dictionary<string, object>();
    var allOk = true;

    try
    {
        await db.Database.ExecuteSqlRawAsync("SELECT 1", ct);
        checks["database"] = "ok";
    }
    catch (Exception ex)
    {
        checks["database"] = $"error: {ex.GetType().Name}";
        allOk = false;
    }

    try
    {
        var aiOk = await ai.PingAsync(ct);
        checks["ai_service"] = aiOk ? "ok" : "unreachable";
        // AI service down isn't fatal — the app falls back to deterministic text.
        // Don't flip allOk based on it.
    }
    catch (Exception ex)
    {
        checks["ai_service"] = $"error: {ex.GetType().Name}";
    }

    return allOk
        ? Results.Ok(new { status = "ready", checks })
        : Results.Json(new { status = "not_ready", checks }, statusCode: 503);
}).AllowAnonymous();

app.MapControllers();

try
{
    app.Run();
}
finally
{
    Log.CloseAndFlush();
}
