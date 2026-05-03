using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Simulyn.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectBriefAndScenarioColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Headline",
                table: "Simulations",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScenarioConfig",
                table: "Simulations",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScenarioType",
                table: "Simulations",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "UniformSlip");

            migrationBuilder.CreateTable(
                name: "ProjectBriefs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Headline = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Body = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    HealthScore = table.Column<int>(type: "integer", nullable: false),
                    ToneTags = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectBriefs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectBriefs_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectBriefs_ProjectId",
                table: "ProjectBriefs",
                column: "ProjectId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProjectBriefs");

            migrationBuilder.DropColumn(
                name: "Headline",
                table: "Simulations");

            migrationBuilder.DropColumn(
                name: "ScenarioConfig",
                table: "Simulations");

            migrationBuilder.DropColumn(
                name: "ScenarioType",
                table: "Simulations");
        }
    }
}
