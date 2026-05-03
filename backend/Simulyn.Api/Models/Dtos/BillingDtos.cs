namespace Simulyn.Api.Models.Dtos;

/// <summary>Returned by GET /api/me — describes the caller and their active org context.</summary>
public record MeDto(
    Guid UserId,
    string Name,
    string Email,
    bool IsPlatformAdmin,
    Guid? ActiveOrganizationId,
    string? ActiveOrganizationName,
    string? ActiveOrganizationRole,
    string Plan,
    string SubscriptionStatus,
    DateTime? SubscriptionExpiresAt,
    bool IsEntitled);

/// <summary>Returned by GET /api/admin/organizations — every org in the system + its billing.</summary>
public record AdminOrgDto(
    Guid OrganizationId,
    string Name,
    string Plan,
    string SubscriptionStatus,
    DateTime? SubscriptionExpiresAt,
    bool IsEntitled,
    int MemberCount,
    int ProjectCount);

public record SubscriptionUpdateRequest(
    string Plan,
    string SubscriptionStatus, // Trial, Active, Suspended, Inactive
    DateTime? SubscriptionExpiresAt,
    string? BillingNotes);
