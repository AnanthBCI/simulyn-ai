namespace Simulyn.Api.Models.Dtos;

public record CreateCheckoutSessionRequest(string Plan);
public record CreateCheckoutSessionResponse(string SessionId, string Url);

public record BudgetStatusDto(int TodayMills, int SoftCapMills, int HardCapMills, string Level);
