using FluentAssertions;
using Simulyn.Api.Models.Entities;
using Simulyn.Api.Services;

namespace Simulyn.Api.Tests;

public class EmailTokenServiceTests
{
    [Fact]
    public async Task IssueAsync_returns_plaintext_and_stores_only_hash()
    {
        using var db = TestFactory.NewDb();
        var svc = new EmailTokenService(db);
        var record = new EmailToken
        {
            Purpose = EmailTokenPurpose.PasswordReset,
            Email = "a@b.com",
            UserId = Guid.NewGuid(),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
        };

        var plaintext = await svc.IssueAsync(record);

        plaintext.Should().NotBeNullOrWhiteSpace();
        plaintext.Length.Should().BeGreaterThan(20);
        record.TokenHash.Should().NotBe(plaintext);
        BCrypt.Net.BCrypt.Verify(plaintext, record.TokenHash).Should().BeTrue();
    }

    [Fact]
    public async Task ConsumeAsync_returns_matching_record_and_marks_consumed()
    {
        using var db = TestFactory.NewDb();
        var svc = new EmailTokenService(db);
        var userId = Guid.NewGuid();
        var plaintext = await svc.IssueAsync(new EmailToken
        {
            Purpose = EmailTokenPurpose.PasswordReset,
            Email = "a@b.com",
            UserId = userId,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
        });

        var consumed = await svc.ConsumeAsync(EmailTokenPurpose.PasswordReset, plaintext);

        consumed.Should().NotBeNull();
        consumed!.UserId.Should().Be(userId);
        consumed.ConsumedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ConsumeAsync_returns_null_for_wrong_token()
    {
        using var db = TestFactory.NewDb();
        var svc = new EmailTokenService(db);
        await svc.IssueAsync(new EmailToken
        {
            Purpose = EmailTokenPurpose.PasswordReset,
            Email = "a@b.com",
            UserId = Guid.NewGuid(),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
        });

        (await svc.ConsumeAsync(EmailTokenPurpose.PasswordReset, "wrong-token")).Should().BeNull();
    }

    [Fact]
    public async Task ConsumeAsync_returns_null_after_expiry()
    {
        using var db = TestFactory.NewDb();
        var svc = new EmailTokenService(db);
        var plaintext = await svc.IssueAsync(new EmailToken
        {
            Purpose = EmailTokenPurpose.OrgInvite,
            Email = "a@b.com",
            OrganizationId = Guid.NewGuid(),
            Role = "Member",
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1),
        });

        (await svc.ConsumeAsync(EmailTokenPurpose.OrgInvite, plaintext)).Should().BeNull();
    }

    [Fact]
    public async Task ConsumeAsync_cannot_reuse_already_consumed_token()
    {
        using var db = TestFactory.NewDb();
        var svc = new EmailTokenService(db);
        var plaintext = await svc.IssueAsync(new EmailToken
        {
            Purpose = EmailTokenPurpose.PasswordReset,
            Email = "a@b.com",
            UserId = Guid.NewGuid(),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
        });

        var first = await svc.ConsumeAsync(EmailTokenPurpose.PasswordReset, plaintext);
        var second = await svc.ConsumeAsync(EmailTokenPurpose.PasswordReset, plaintext);

        first.Should().NotBeNull();
        second.Should().BeNull();
    }
}
