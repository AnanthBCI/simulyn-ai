namespace Simulyn.Api.Models.Entities;

public class ProjectTask
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int Progress { get; set; }
    public string Status { get; set; } = "InProgress";
    public DateTime CreatedAt { get; set; }

    public Project Project { get; set; } = null!;
    public ICollection<Prediction> Predictions { get; set; } = new List<Prediction>();
}
