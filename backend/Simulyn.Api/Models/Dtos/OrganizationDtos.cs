namespace Simulyn.Api.Models.Dtos;

public record OrganizationDto(
    Guid Id,
    string Name,
    string Plan,
    string SubscriptionStatus,
    DateTime? SubscriptionExpiresAt,
    bool IsEntitled,
    string MyRole,
    int MemberCount,
    int ProjectCount);

public record CreateOrganizationRequest(string Name);

public record UpdateOrganizationRequest(string? Name);

public record OrganizationMemberDto(
    Guid UserId,
    string Name,
    string Email,
    string Role,
    DateTime JoinedAt);

public record AddMemberRequest(string Email, string Role);
public record UpdateMemberRoleRequest(string Role);
