using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Dtos;
using Simulyn.Api.Models.Entities;
using Simulyn.Api.Services;

namespace Simulyn.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/organizations")]
public class OrganizationsController(
    AppDbContext db,
    BillingService billing,
    EmailTokenService tokens,
    IEmailSender email,
    IOptions<EmailOptions> emailOptions) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<OrganizationDto>>> Mine(CancellationToken ct)
    {
        var memberships = await db.OrganizationMembers
            .AsNoTracking()
            .Include(m => m.Organization)
            .Where(m => m.UserId == UserId)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(ct);

        var orgIds = memberships.Select(m => m.OrganizationId).ToList();

        var memberCounts = await db.OrganizationMembers
            .AsNoTracking()
            .Where(m => orgIds.Contains(m.OrganizationId))
            .GroupBy(m => m.OrganizationId)
            .Select(g => new { OrgId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.OrgId, x => x.Count, ct);

        var projectCounts = await db.Projects
            .AsNoTracking()
            .Where(p => orgIds.Contains(p.OrganizationId))
            .GroupBy(p => p.OrganizationId)
            .Select(g => new { OrgId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.OrgId, x => x.Count, ct);

        var dtos = new List<OrganizationDto>();
        foreach (var m in memberships)
        {
            var entitled = await billing.IsEntitledAsync(m.OrganizationId, ct);
            dtos.Add(new OrganizationDto(
                m.Organization.Id,
                m.Organization.Name,
                m.Organization.Plan,
                m.Organization.SubscriptionStatus,
                m.Organization.SubscriptionExpiresAt,
                entitled,
                m.Role,
                memberCounts.TryGetValue(m.OrganizationId, out var mc) ? mc : 0,
                projectCounts.TryGetValue(m.OrganizationId, out var pc) ? pc : 0));
        }
        return Ok(dtos);
    }

    [HttpPost]
    public async Task<ActionResult<OrganizationDto>> Create([FromBody] CreateOrganizationRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest("Organization name is required.");

        var org = new Organization
        {
            Id = Guid.NewGuid(),
            Name = req.Name.Trim(),
            CreatedAt = DateTime.UtcNow,
            Plan = "Starter",
            SubscriptionStatus = "Trial",
            SubscriptionActivatedAt = DateTime.UtcNow,
            SubscriptionExpiresAt = DateTime.UtcNow.AddDays(30),
        };
        var membership = new OrganizationMember
        {
            OrganizationId = org.Id,
            UserId = UserId,
            Role = OrgRoles.Owner,
            CreatedAt = DateTime.UtcNow,
        };
        db.Organizations.Add(org);
        db.OrganizationMembers.Add(membership);
        await db.SaveChangesAsync(ct);

        return Ok(new OrganizationDto(
            org.Id, org.Name, org.Plan, org.SubscriptionStatus, org.SubscriptionExpiresAt,
            await billing.IsEntitledAsync(org.Id, ct),
            OrgRoles.Owner, 1, 0));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OrganizationDto>> Get(Guid id, CancellationToken ct)
    {
        var membership = await db.OrganizationMembers
            .AsNoTracking()
            .Include(m => m.Organization)
            .FirstOrDefaultAsync(m => m.OrganizationId == id && m.UserId == UserId, ct);
        if (membership == null) return NotFound();

        var memberCount = await db.OrganizationMembers.CountAsync(m => m.OrganizationId == id, ct);
        var projectCount = await db.Projects.CountAsync(p => p.OrganizationId == id, ct);
        return Ok(new OrganizationDto(
            membership.Organization.Id,
            membership.Organization.Name,
            membership.Organization.Plan,
            membership.Organization.SubscriptionStatus,
            membership.Organization.SubscriptionExpiresAt,
            await billing.IsEntitledAsync(id, ct),
            membership.Role,
            memberCount,
            projectCount));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateOrganizationRequest req, CancellationToken ct)
    {
        var membership = await db.OrganizationMembers
            .FirstOrDefaultAsync(m => m.OrganizationId == id && m.UserId == UserId, ct);
        if (membership == null) return NotFound();
        if (!OrgRoles.CanManageMembers(membership.Role))
            return StatusCode(403, "Only Admins or Owners can update the organization.");

        var org = await db.Organizations.FirstAsync(o => o.Id == id, ct);
        if (!string.IsNullOrWhiteSpace(req.Name)) org.Name = req.Name.Trim();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var membership = await db.OrganizationMembers
            .FirstOrDefaultAsync(m => m.OrganizationId == id && m.UserId == UserId, ct);
        if (membership == null) return NotFound();
        if (!OrgRoles.IsOwner(membership.Role))
            return StatusCode(403, "Only the Owner can delete the organization.");

        // Don't let a user delete their last org — they'd be locked out of the product.
        var orgsForUser = await db.OrganizationMembers.CountAsync(m => m.UserId == UserId, ct);
        if (orgsForUser <= 1)
            return BadRequest("You can't delete your last organization. Create another first.");

        var org = await db.Organizations.FirstAsync(o => o.Id == id, ct);
        db.Organizations.Remove(org);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---------------- Members ----------------

    [HttpGet("{id:guid}/members")]
    public async Task<ActionResult<IEnumerable<OrganizationMemberDto>>> Members(Guid id, CancellationToken ct)
    {
        var iAmMember = await db.OrganizationMembers
            .AsNoTracking()
            .AnyAsync(m => m.OrganizationId == id && m.UserId == UserId, ct);
        if (!iAmMember) return NotFound();

        var members = await db.OrganizationMembers
            .AsNoTracking()
            .Include(m => m.User)
            .Where(m => m.OrganizationId == id)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new OrganizationMemberDto(m.User.Id, m.User.Name, m.User.Email, m.Role, m.CreatedAt))
            .ToListAsync(ct);
        return Ok(members);
    }

    [HttpPost("{id:guid}/members")]
    public async Task<ActionResult<OrganizationMemberDto>> AddMember(Guid id, [FromBody] AddMemberRequest req, CancellationToken ct)
    {
        var myMembership = await db.OrganizationMembers
            .FirstOrDefaultAsync(m => m.OrganizationId == id && m.UserId == UserId, ct);
        if (myMembership == null) return NotFound();
        if (!OrgRoles.CanManageMembers(myMembership.Role))
            return StatusCode(403, "Only Admins or Owners can add members.");

        if (string.IsNullOrWhiteSpace(req.Email))
            return BadRequest("Email is required.");
        var role = OrgRoles.IsValid(req.Role) ? req.Role : OrgRoles.Member;
        if (string.Equals(role, OrgRoles.Owner, StringComparison.OrdinalIgnoreCase) && !OrgRoles.IsOwner(myMembership.Role))
            return StatusCode(403, "Only the Owner can grant Owner role.");

        var emailAddr = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == emailAddr, ct);

        // If the invitee doesn't have an account yet, issue a signed invite token
        // and email them a /register?token=... link. We do NOT create a membership
        // row yet — that happens on register when they consume the token.
        if (user == null)
        {
            var me = await db.Users.FirstOrDefaultAsync(u => u.Id == UserId, ct);
            var org = await db.Organizations.FirstOrDefaultAsync(o => o.Id == id, ct);
            if (org == null) return NotFound();

            var record = new EmailToken
            {
                Purpose = EmailTokenPurpose.OrgInvite,
                Email = emailAddr,
                OrganizationId = id,
                Role = role,
                InvitedByUserId = UserId,
                ExpiresAt = DateTime.UtcNow.Add(EmailTokenService.OrgInviteTtl),
            };
            var plaintext = await tokens.IssueAsync(record, ct);
            await email.SendAsync(
                EmailTemplates.OrgInviteNewUser(emailAddr, emailOptions.Value.AppUrl, plaintext, org.Name, me?.Name ?? "A teammate", role),
                ct);

            // 202 Accepted — the invite is queued but no membership row exists yet.
            return Accepted(new
            {
                status = "invited",
                email = emailAddr,
                role,
                expiresAt = record.ExpiresAt,
            });
        }

        var existing = await db.OrganizationMembers
            .FirstOrDefaultAsync(m => m.OrganizationId == id && m.UserId == user.Id, ct);
        if (existing != null)
            return Conflict("That user is already a member of this organization.");

        var newMember = new OrganizationMember
        {
            OrganizationId = id,
            UserId = user.Id,
            Role = role,
            CreatedAt = DateTime.UtcNow,
        };
        db.OrganizationMembers.Add(newMember);
        await db.SaveChangesAsync(ct);

        return Ok(new OrganizationMemberDto(user.Id, user.Name, user.Email, role, newMember.CreatedAt));
    }

    [HttpPut("{id:guid}/members/{userId:guid}")]
    public async Task<IActionResult> UpdateMemberRole(Guid id, Guid userId, [FromBody] UpdateMemberRoleRequest req, CancellationToken ct)
    {
        var myMembership = await db.OrganizationMembers
            .FirstOrDefaultAsync(m => m.OrganizationId == id && m.UserId == UserId, ct);
        if (myMembership == null) return NotFound();
        if (!OrgRoles.IsOwner(myMembership.Role))
            return StatusCode(403, "Only the Owner can change member roles.");

        if (!OrgRoles.IsValid(req.Role))
            return BadRequest("Invalid role.");

        var target = await db.OrganizationMembers
            .FirstOrDefaultAsync(m => m.OrganizationId == id && m.UserId == userId, ct);
        if (target == null) return NotFound();

        if (target.UserId == UserId && OrgRoles.IsOwner(target.Role) && !OrgRoles.IsOwner(req.Role))
        {
            // Don't let the only Owner demote themselves.
            var otherOwners = await db.OrganizationMembers.CountAsync(
                m => m.OrganizationId == id && m.Role == OrgRoles.Owner && m.UserId != UserId, ct);
            if (otherOwners == 0)
                return BadRequest("You are the only Owner. Promote someone else to Owner first.");
        }

        target.Role = req.Role;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId, CancellationToken ct)
    {
        var myMembership = await db.OrganizationMembers
            .FirstOrDefaultAsync(m => m.OrganizationId == id && m.UserId == UserId, ct);
        if (myMembership == null) return NotFound();

        // Self-removal is allowed; otherwise needs Admin+.
        if (userId != UserId && !OrgRoles.CanManageMembers(myMembership.Role))
            return StatusCode(403, "Only Admins or Owners can remove other members.");

        var target = await db.OrganizationMembers
            .FirstOrDefaultAsync(m => m.OrganizationId == id && m.UserId == userId, ct);
        if (target == null) return NotFound();

        if (OrgRoles.IsOwner(target.Role))
        {
            var otherOwners = await db.OrganizationMembers.CountAsync(
                m => m.OrganizationId == id && m.Role == OrgRoles.Owner && m.UserId != userId, ct);
            if (otherOwners == 0)
                return BadRequest("Cannot remove the only Owner. Promote someone else to Owner first.");
        }

        db.OrganizationMembers.Remove(target);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
