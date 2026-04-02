namespace Simulyn.Api.Models.Dtos;

public record MeDto(
    Guid UserId,
    string Plan,
    string SubscriptionStatus,
    DateTime? SubscriptionExpiresAt,
    bool IsEntitled);

public record AdminUserDto(
    Guid UserId,
    string Name,
    string Email,
    string Plan,
    string SubscriptionStatus,
    DateTime? SubscriptionExpiresAt,
    bool IsEntitled);

public record SubscriptionUpdateRequest(
    string Plan,
    string SubscriptionStatus, // Trial, Active, Suspended, Inactive
    DateTime? SubscriptionExpiresAt,
    string? BillingNotes);

