using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Simulyn.Api.Data;

#nullable disable

namespace Simulyn.Api.Migrations;

[DbContext(typeof(AppDbContext))]
partial class AppDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasAnnotation("ProductVersion", "8.0.11")
            .HasAnnotation("Relational:MaxIdentifierLength", 63);

        modelBuilder.Entity("Simulyn.Api.Models.Entities.User", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("uuid");

            b.Property<DateTime>("CreatedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<string>("Email")
                .IsRequired()
                .HasMaxLength(320)
                .HasColumnType("character varying(320)");

            b.Property<string>("Name")
                .IsRequired()
                .HasMaxLength(200)
                .HasColumnType("character varying(200)");

            b.Property<string>("PasswordHash")
                .IsRequired()
                .HasColumnType("text");

            b.HasKey("Id");

            b.HasIndex("Email")
                .IsUnique();

            b.ToTable("Users");
        });

        modelBuilder.Entity("Simulyn.Api.Models.Entities.Project", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("uuid");

            b.Property<DateTime>("CreatedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<DateOnly>("EndDate")
                .HasColumnType("date");

            b.Property<string>("Name")
                .IsRequired()
                .HasMaxLength(300)
                .HasColumnType("character varying(300)");

            b.Property<DateOnly>("StartDate")
                .HasColumnType("date");

            b.Property<string>("Status")
                .IsRequired()
                .HasMaxLength(50)
                .HasColumnType("character varying(50)");

            b.Property<Guid>("UserId")
                .HasColumnType("uuid");

            b.HasKey("Id");

            b.HasIndex("UserId");

            b.ToTable("Projects");

            b.HasOne("Simulyn.Api.Models.Entities.User", null)
                .WithMany("Projects")
                .HasForeignKey("UserId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
        });

        modelBuilder.Entity("Simulyn.Api.Models.Entities.ProjectTask", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("uuid");

            b.Property<DateTime>("CreatedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<DateOnly>("EndDate")
                .HasColumnType("date");

            b.Property<string>("Name")
                .IsRequired()
                .HasMaxLength(300)
                .HasColumnType("character varying(300)");

            b.Property<Guid>("ProjectId")
                .HasColumnType("uuid");

            b.Property<int>("Progress")
                .HasColumnType("integer");

            b.Property<DateOnly>("StartDate")
                .HasColumnType("date");

            b.Property<string>("Status")
                .IsRequired()
                .HasMaxLength(50)
                .HasColumnType("character varying(50)");

            b.HasKey("Id");

            b.HasIndex("ProjectId");

            b.ToTable("Tasks");

            b.HasOne("Simulyn.Api.Models.Entities.Project", null)
                .WithMany("Tasks")
                .HasForeignKey("ProjectId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
        });

        modelBuilder.Entity("Simulyn.Api.Models.Entities.Prediction", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("uuid");

            b.Property<DateTime>("CreatedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<int>("DelayDays")
                .HasColumnType("integer");

            b.Property<string>("Recommendation")
                .HasMaxLength(4000)
                .HasColumnType("character varying(4000)");

            b.Property<string>("RiskLevel")
                .IsRequired()
                .HasMaxLength(20)
                .HasColumnType("character varying(20)");

            b.Property<string>("Summary")
                .HasMaxLength(2000)
                .HasColumnType("character varying(2000)");

            b.Property<Guid>("TaskId")
                .HasColumnType("uuid");

            b.HasKey("Id");

            b.HasIndex("TaskId");

            b.ToTable("Predictions");

            b.HasOne("Simulyn.Api.Models.Entities.ProjectTask", null)
                .WithMany("Predictions")
                .HasForeignKey("TaskId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
        });

        modelBuilder.Entity("Simulyn.Api.Models.Entities.Simulation", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("uuid");

            b.Property<DateTime>("CreatedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<string>("ImpactSummary")
                .HasMaxLength(4000)
                .HasColumnType("character varying(4000)");

            b.Property<int>("InputDelay")
                .HasColumnType("integer");

            b.Property<int>("PredictedDelay")
                .HasColumnType("integer");

            b.Property<Guid>("ProjectId")
                .HasColumnType("uuid");

            b.HasKey("Id");

            b.HasIndex("ProjectId");

            b.ToTable("Simulations");

            b.HasOne("Simulyn.Api.Models.Entities.Project", null)
                .WithMany("Simulations")
                .HasForeignKey("ProjectId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
        });
    }
}
