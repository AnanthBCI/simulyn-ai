using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Simulyn.Api.Migrations;

 [Migration("20260402130000_AddUserBillingAndAdmin")]
public partial class AddUserBillingAndAdmin : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "IsPlatformAdmin",
            table: "Users",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<string>(
            name: "Plan",
            table: "Users",
            type: "character varying(50)",
            maxLength: 50,
            nullable: false,
            defaultValue: "Starter");

        migrationBuilder.AddColumn<string>(
            name: "SubscriptionStatus",
            table: "Users",
            type: "character varying(30)",
            maxLength: 30,
            nullable: false,
            defaultValue: "Trial");

        migrationBuilder.AddColumn<DateTime>(
            name: "SubscriptionActivatedAt",
            table: "Users",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "SubscriptionExpiresAt",
            table: "Users",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "BillingNotes",
            table: "Users",
            type: "character varying(4000)",
            maxLength: 4000,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "BillingNotes", table: "Users");
        migrationBuilder.DropColumn(name: "SubscriptionActivatedAt", table: "Users");
        migrationBuilder.DropColumn(name: "SubscriptionExpiresAt", table: "Users");
        migrationBuilder.DropColumn(name: "SubscriptionStatus", table: "Users");
        migrationBuilder.DropColumn(name: "Plan", table: "Users");
        migrationBuilder.DropColumn(name: "IsPlatformAdmin", table: "Users");
    }
}

