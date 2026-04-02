using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Models.Entities;

namespace Simulyn.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectTask> Tasks => Set<ProjectTask>();
    public DbSet<Prediction> Predictions => Set<Prediction>();
    public DbSet<Simulation> Simulations => Set<Simulation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Name).HasMaxLength(200);
            e.Property(u => u.Email).HasMaxLength(320);

            e.Property(u => u.Plan).HasMaxLength(50).HasDefaultValue("Starter");
            e.Property(u => u.SubscriptionStatus).HasMaxLength(30).HasDefaultValue("Trial");
            e.Property(u => u.BillingNotes).HasMaxLength(4000);
        });

        modelBuilder.Entity<Project>(e =>
        {
            e.Property(p => p.Name).HasMaxLength(300);
            e.Property(p => p.Status).HasMaxLength(50);
            e.HasOne(p => p.User).WithMany(u => u.Projects).HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProjectTask>(e =>
        {
            e.ToTable("Tasks");
            e.Property(t => t.Name).HasMaxLength(300);
            e.Property(t => t.Status).HasMaxLength(50);
            e.HasOne(t => t.Project).WithMany(p => p.Tasks).HasForeignKey(t => t.ProjectId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Prediction>(e =>
        {
            e.Property(p => p.RiskLevel).HasMaxLength(20);
            e.Property(p => p.Summary).HasMaxLength(2000);
            e.Property(p => p.Recommendation).HasMaxLength(4000);
            e.HasOne(p => p.Task).WithMany(t => t.Predictions).HasForeignKey(p => p.TaskId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Simulation>(e =>
        {
            e.Property(s => s.ImpactSummary).HasMaxLength(4000);
            e.HasOne(s => s.Project).WithMany(p => p.Simulations).HasForeignKey(s => s.ProjectId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
