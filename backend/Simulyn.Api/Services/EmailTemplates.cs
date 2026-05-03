namespace Simulyn.Api.Services;

public static class EmailTemplates
{
    /// <summary>Password reset email — link to /reset-password?token=...</summary>
    public static EmailMessage PasswordReset(string toEmail, string appUrl, string token)
    {
        var link = $"{appUrl.TrimEnd('/')}/reset-password?token={Uri.EscapeDataString(token)}";
        var html = $@"<div style='font-family:Inter,system-ui,sans-serif;color:#0f172a'>
  <h2 style='margin:0 0 12px'>Reset your Simulyn AI password</h2>
  <p>Someone asked to reset the password on your Simulyn AI account.</p>
  <p>Click the button below to choose a new password. The link is valid for <strong>1 hour</strong>.</p>
  <p><a href='{link}' style='display:inline-block;padding:12px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:500'>Reset password</a></p>
  <p style='color:#64748b;font-size:13px'>If you didn't ask for this, you can safely ignore this email — your password won't change.</p>
  <p style='color:#94a3b8;font-size:12px'>Link trouble? Paste this into your browser:<br/>{link}</p>
</div>";
        var text = $"Reset your Simulyn AI password\n\nClick the link below (valid for 1 hour):\n{link}\n\nIf you didn't ask for this, ignore this email.";
        return new EmailMessage(toEmail, "Reset your Simulyn AI password", html, text);
    }

    /// <summary>Invite email for a user that doesn't yet have an account.</summary>
    public static EmailMessage OrgInviteNewUser(string toEmail, string appUrl, string token, string orgName, string inviterName, string role)
    {
        var link = $"{appUrl.TrimEnd('/')}/register?token={Uri.EscapeDataString(token)}&email={Uri.EscapeDataString(toEmail)}";
        var html = $@"<div style='font-family:Inter,system-ui,sans-serif;color:#0f172a'>
  <h2 style='margin:0 0 12px'>You're invited to {System.Net.WebUtility.HtmlEncode(orgName)} on Simulyn AI</h2>
  <p>{System.Net.WebUtility.HtmlEncode(inviterName)} invited you to join <strong>{System.Net.WebUtility.HtmlEncode(orgName)}</strong> on Simulyn AI as a <strong>{System.Net.WebUtility.HtmlEncode(role)}</strong>.</p>
  <p>Create an account with this email and you'll be added to the organization automatically. The invite is valid for <strong>7 days</strong>.</p>
  <p><a href='{link}' style='display:inline-block;padding:12px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:500'>Accept invite</a></p>
  <p style='color:#94a3b8;font-size:12px'>Link trouble? Paste this into your browser:<br/>{link}</p>
</div>";
        var text = $"You're invited to {orgName} on Simulyn AI\n\n{inviterName} invited you as {role}. Create your account here (valid 7 days):\n{link}";
        return new EmailMessage(toEmail, $"You're invited to {orgName} on Simulyn AI", html, text);
    }

    /// <summary>Heads-up email when a task crosses into High risk.</summary>
    public static EmailMessage HighRiskAlert(string toEmail, string appUrl, string projectName, string taskName, int delayDays, string projectId, string summary)
    {
        var link = $"{appUrl.TrimEnd('/')}/projects/{projectId}";
        var html = $@"<div style='font-family:Inter,system-ui,sans-serif;color:#0f172a'>
  <h2 style='margin:0 0 12px;color:#be123c'>⚠ Task just crossed into High risk</h2>
  <p><strong>{System.Net.WebUtility.HtmlEncode(projectName)}</strong> › {System.Net.WebUtility.HtmlEncode(taskName)}</p>
  <p style='padding:12px;background:#fef2f2;border-left:3px solid #ef4444;border-radius:4px;color:#7f1d1d'>Predicted delay: <strong>{delayDays} days</strong></p>
  <p>{System.Net.WebUtility.HtmlEncode(summary)}</p>
  <p><a href='{link}' style='display:inline-block;padding:12px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:500'>Open project</a></p>
</div>";
        var text = $"⚠ {taskName} on {projectName} just crossed into High risk. Predicted delay: {delayDays} days.\n{summary}\n\nOpen the project: {link}";
        return new EmailMessage(toEmail, $"⚠ High risk: {taskName} on {projectName}", html, text);
    }

    /// <summary>Weekly Monday recap email — HTML summary + link to dashboard.</summary>
    public static EmailMessage WeeklyRecap(string toEmail, string appUrl, string orgName, string headline, IReadOnlyList<string> bullets)
    {
        var link = $"{appUrl.TrimEnd('/')}/dashboard";
        var bulletHtml = string.Join("", bullets.Select(b => $"<li style='margin-bottom:6px'>{System.Net.WebUtility.HtmlEncode(b)}</li>"));
        var html = $@"<div style='font-family:Inter,system-ui,sans-serif;color:#0f172a'>
  <h2 style='margin:0 0 6px'>Your week on {System.Net.WebUtility.HtmlEncode(orgName)}</h2>
  <p style='font-size:17px;color:#1e293b;margin:0 0 16px'>{System.Net.WebUtility.HtmlEncode(headline)}</p>
  <ul style='padding-left:20px;line-height:1.55'>{bulletHtml}</ul>
  <p style='margin-top:20px'><a href='{link}' style='display:inline-block;padding:10px 18px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:500'>Open dashboard</a></p>
  <p style='color:#94a3b8;font-size:12px;margin-top:24px'>You're receiving this because you're a member of {System.Net.WebUtility.HtmlEncode(orgName)} on Simulyn AI. Reply STOP to opt out.</p>
</div>";
        var bulletText = string.Join("\n", bullets.Select(b => $" • {b}"));
        var text = $"{headline}\n\n{bulletText}\n\nOpen dashboard: {link}";
        return new EmailMessage(toEmail, $"Weekly look-ahead — {orgName}", html, text);
    }
}
