namespace Simulyn.Api.Models.Dtos;

public record RunPredictionRequest(Guid? TaskId, Guid? ProjectId);
public record PredictionResultDto(Guid Id, Guid TaskId, string RiskLevel, int DelayDays, string? Summary, string? Recommendation, DateTime CreatedAt);
