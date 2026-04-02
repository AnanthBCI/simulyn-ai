namespace Simulyn.Api.Models.Dtos;

public record RunSimulationRequest(Guid ProjectId, int InputDelayDays);
public record SimulationResultDto(Guid Id, Guid ProjectId, int InputDelay, int PredictedDelay, string? ImpactSummary, DateTime CreatedAt);
