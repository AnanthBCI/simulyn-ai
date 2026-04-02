namespace Simulyn.Api.Models.Dtos;

public record DashboardSummaryDto(int TotalProjects, int HighRiskTasks, int OpenAlerts);
public record AlertDto(string Type, string Message, Guid? ProjectId, Guid? TaskId, string RiskLevel, DateTime CreatedAt);
