using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Simulyn.Api.Services;

public record EmailMessage(string To, string Subject, string HtmlBody, string? TextBody = null);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}

/// <summary>
/// Zero-config fallback. Logs the email payload to stdout instead of sending.
/// Used automatically when no <c>Email:Resend:ApiKey</c> is configured — keeps
/// local dev / demo running without a real Resend account, and keeps the password
/// reset + invite flows testable (just copy the token from the logs).
/// </summary>
public class ConsoleEmailSender(ILogger<ConsoleEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[Email:Console] To={To}\n  Subject: {Subject}\n  ----- HTML -----\n{Html}\n  ----- TEXT -----\n{Text}",
            message.To, message.Subject, message.HtmlBody, message.TextBody ?? "(none)");
        return Task.CompletedTask;
    }
}

public class EmailOptions
{
    /// <summary>Which sender to wire up. "resend" | "console". Defaults to console if key missing.</summary>
    public string Provider { get; set; } = "auto";
    public string FromAddress { get; set; } = "Simulyn AI <noreply@simulyn.ai>";
    public string AppUrl { get; set; } = "http://localhost:3000";
    public ResendOptions Resend { get; set; } = new();
}

public class ResendOptions
{
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.resend.com";
}

public class ResendEmailSender(HttpClient http, IOptions<EmailOptions> options, ILogger<ResendEmailSender> logger) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        var opt = options.Value;
        if (string.IsNullOrWhiteSpace(opt.Resend.ApiKey))
        {
            logger.LogWarning("[Email:Resend] API key not set; dropping email to {To}", message.To);
            return;
        }

        using var req = new HttpRequestMessage(HttpMethod.Post, new Uri(new Uri(opt.Resend.BaseUrl), "/emails"));
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", opt.Resend.ApiKey);
        req.Content = JsonContent.Create(new ResendEmailBody(
            From: opt.FromAddress,
            To: new[] { message.To },
            Subject: message.Subject,
            Html: message.HtmlBody,
            Text: message.TextBody));

        try
        {
            using var res = await http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync(ct);
                logger.LogError("[Email:Resend] {Status} sending to {To}: {Body}", (int)res.StatusCode, message.To, body);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Email:Resend] exception sending to {To}", message.To);
        }
    }

    private record ResendEmailBody(
        [property: JsonPropertyName("from")] string From,
        [property: JsonPropertyName("to")] string[] To,
        [property: JsonPropertyName("subject")] string Subject,
        [property: JsonPropertyName("html")] string Html,
        [property: JsonPropertyName("text")] string? Text);
}
