using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Models.Entities;

namespace Simulyn.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<OrganizationMember> OrganizationMembers => Set<OrganizationMember>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectTask> Tasks => Set<ProjectTask>();
    public DbSet<Prediction> Predictions => Set<Prediction>();
    public DbSet<Simulation> Simulations => Set<Simulation>();
    public DbSet<ProjectBrief> ProjectBriefs => Set<ProjectBrief>();
    public DbSet<EmailToken> EmailTokens => Set<EmailToken>();
    public DbSet<UsageEvent> UsageEvents => Set<UsageEvent>();
    public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();
    public DbSet<NotificationDelivery> NotificationDeliveries => Set<NotificationDelivery>();
    public DbSet<ProcessedStripeEvent> ProcessedStripeEvents => Set<ProcessedStripeEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Name).HasMaxLength(200);
            e.Property(u => u.Email).HasMaxLength(320);
        });

        modelBuilder.Entity<Organization>(e =>
        {
            e.Property(o => o.Name).HasMaxLength(200).IsRequired();
            e.Property(o => o.Plan).HasMaxLength(50).HasDefaultValue("Starter");
            e.Property(o => o.SubscriptionStatus).HasMaxLength(30).HasDefaultValue("Trial");
            e.Property(o => o.BillingNotes).HasMaxLength(4000);
        });

        modelBuilder.Entity<OrganizationMember>(e =>
        {
            e.HasKey(m => new { m.OrganizationId, m.UserId });
            e.Property(m => m.Role).HasMaxLength(20).IsRequired();
            e.HasOne(m => m.Organization).WithMany(o => o.Members)
                .HasForeignKey(m => m.OrganizationId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(m => m.User).WithMany(u => u.Memberships)
                .HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(m => m.UserId);
        });

        modelBuilder.Entity<Project>(e =>
        {
            e.Property(p => p.Name).HasMaxLength(300);
            e.Property(p => p.Status).HasMaxLength(50);
            e.HasOne(p => p.Organization).WithMany(o => o.Projects)
                .HasForeignKey(p => p.OrganizationId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(p => p.CreatedByUser).WithMany()
                .HasForeignKey(p => p.CreatedByUserId).OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(p => p.OrganizationId);
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
            e.Property(s => s.ScenarioType).HasMaxLength(40).HasDefaultValue("UniformSlip");
            e.Property(s => s.ScenarioConfig).HasColumnType("jsonb");
            e.Property(s => s.Headline).HasMaxLength(300);
            e.HasOne(s => s.Project).WithMany(p => p.Simulations).HasForeignKey(s => s.ProjectId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProjectBrief>(e =>
        {
            e.Property(b => b.Headline).HasMaxLength(300).IsRequired();
            e.Property(b => b.Body).HasMaxLength(2000).IsRequired();
            e.Property(b => b.ToneTags).HasMaxLength(500);
            e.HasIndex(b => b.ProjectId).IsUnique();
            e.HasOne(b => b.Project).WithMany().HasForeignKey(b => b.ProjectId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EmailToken>(e =>
        {
            e.Property(t => t.TokenHash).HasMaxLength(200).IsRequired();
            e.Property(t => t.Purpose).HasMaxLength(30).IsRequired();
            e.Property(t => t.Email).HasMaxLength(320).IsRequired();
            e.Property(t => t.Role).HasMaxLength(20);
            e.HasIndex(t => new { t.Purpose, t.Email });
            e.HasIndex(t => t.TokenHash);
        });

        modelBuilder.Entity<UsageEvent>(e =>
        {
            e.Property(u => u.Kind).HasMaxLength(40).IsRequired();
            e.Property(u => u.Provider).HasMaxLength(30);
            e.Property(u => u.Model).HasMaxLength(80);
            e.HasIndex(u => new { u.OrganizationId, u.OccurredAt });
        });

        modelBuilder.Entity<NotificationPreference>(e =>
        {
            e.HasKey(p => new { p.UserId, p.OrganizationId });
            e.HasOne(p => p.User).WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(p => p.Organization).WithMany().HasForeignKey(p => p.OrganizationId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<NotificationDelivery>(e =>
        {
            e.Property(d => d.Kind).HasMaxLength(40).IsRequired();
            e.Property(d => d.Email).HasMaxLength(320).IsRequired();
            e.Property(d => d.DedupKey).HasMaxLength(200);
            e.HasIndex(d => new { d.OrganizationId, d.Kind, d.DedupKey });
            e.HasIndex(d => d.SentAt);
        });

        modelBuilder.Entity<ProcessedStripeEvent>(e =>
        {
            e.Property(p => p.EventId).HasMaxLength(80).IsRequired();
            e.Property(p => p.EventType).HasMaxLength(100).IsRequired();
            e.HasIndex(p => p.EventId).IsUnique();
        });
    }
}
