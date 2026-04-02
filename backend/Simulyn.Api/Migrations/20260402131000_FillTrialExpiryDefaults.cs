using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Simulyn.Api.Migrations;

[Migration("20260402131000_FillTrialExpiryDefaults")]
public partial class FillTrialExpiryDefaults : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // If older users have Trial status but no expiry set, default them to 30 days from now.
        migrationBuilder.Sql(
            "UPDATE \"Users\" " +
            "SET \"SubscriptionActivatedAt\" = COALESCE(\"SubscriptionActivatedAt\", NOW()), " +
            "\"SubscriptionExpiresAt\" = COALESCE(\"SubscriptionExpiresAt\", NOW() + INTERVAL '30 days') " +
            "WHERE \"SubscriptionStatus\" = 'Trial' AND \"SubscriptionExpiresAt\" IS NULL;"
        );
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Intentionally left blank. Reverting default expiry dates isn't safe.
    }
}

