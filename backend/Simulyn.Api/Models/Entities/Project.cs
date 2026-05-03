namespace Simulyn.Api.Models.Entities;

public class Project
{
    public Guid Id { get; set; }

    /// <summary>Tenant scope. All authorization and visibility checks are per organization.</summary>
    public Guid OrganizationId { get; set; }

    /// <summary>Audit-only — who created this project. Null for legacy/imported data.</summary>
    public Guid? CreatedByUserId { get; set; }

    public string Name { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; }

    public Organization Organization { get; set; } = null!;
    public User? CreatedByUser { get; set; }
    public ICollection<ProjectTask> Tasks { get; set; } = new List<ProjectTask>();
    public ICollection<Simulation> Simulations { get; set; } = new List<Simulation>();
}
