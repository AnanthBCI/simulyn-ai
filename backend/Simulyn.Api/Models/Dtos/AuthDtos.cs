namespace Simulyn.Api.Models.Dtos;

public record RegisterRequest(string Name, string Email, string Password, string? InviteToken = null);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string Token, Guid UserId, string Name, string Email);

public record RequestPasswordResetRequest(string Email);
public record ResetPasswordRequest(string Token, string Password);

public record InvitePreviewResponse(string Email, string OrganizationName, string Role, DateTime ExpiresAt);
