namespace Simulyn.Api.Models.Entities;

public class Simulation
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public int InputDelay { get; set; }
    public int PredictedDelay { get; set; }
    public string? ImpactSummary { get; set; }
    public DateTime CreatedAt { get; set; }

    public Project Project { get; set; } = null!;
}
