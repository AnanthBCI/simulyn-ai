namespace Simulyn.Api.Models.Entities;

public class Prediction
{
    public Guid Id { get; set; }
    public Guid TaskId { get; set; }
    public string RiskLevel { get; set; } = "Low";
    public int DelayDays { get; set; }
    public string? Summary { get; set; }
    public string? Recommendation { get; set; }
    public DateTime CreatedAt { get; set; }

    public ProjectTask Task { get; set; } = null!;
}
