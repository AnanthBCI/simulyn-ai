using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Simulyn.Api.Data;

namespace Simulyn.Api.Services;

/// <summary>
/// Renders the weekly look-ahead as a one-page PDF. Receives the same data
/// shape we feed the AI weekly-recap endpoint, plus the AI headline+bullets.
/// Deterministic — no LLM call in here; if you want the AI narrative, grab
/// it from the /api/dashboard/weekly-recap endpoint and pass it in.
/// </summary>
public class WeeklyRecapPdfService(AppDbContext db)
{
    public async Task<byte[]> RenderAsync(Guid organizationId, string headline, IReadOnlyList<string> bullets, CancellationToken ct = default)
    {
        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Id == organizationId, ct)
                  ?? throw new InvalidOperationException($"Org {organizationId} not found");

        var projects = await db.Projects
            .Where(p => p.OrganizationId == organizationId)
            .Select(p => new
            {
                p.Id,
                p.Name,
                TotalTasks = p.Tasks.Count,
                HighRisk = p.Tasks.Count(t => t.Predictions.OrderByDescending(pp => pp.CreatedAt).FirstOrDefault()!.RiskLevel == "High"),
                MediumRisk = p.Tasks.Count(t => t.Predictions.OrderByDescending(pp => pp.CreatedAt).FirstOrDefault()!.RiskLevel == "Medium"),
            })
            .ToListAsync(ct);

        var generatedAt = DateTime.UtcNow;

        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(ts => ts.FontFamily("Helvetica").FontSize(10).FontColor(Colors.Grey.Darken4));

                page.Header().Row(row =>
                {
                    row.RelativeItem().Column(col =>
                    {
                        col.Item().Text("Weekly look-ahead").FontSize(20).Bold().FontColor(Colors.Blue.Darken2);
                        col.Item().Text(org.Name).FontSize(12).FontColor(Colors.Grey.Darken1);
                    });
                    row.ConstantItem(140).AlignRight().Text(generatedAt.ToString("dddd, MMM d, yyyy")).FontSize(10).FontColor(Colors.Grey.Darken1);
                });

                page.Content().PaddingVertical(20).Column(col =>
                {
                    col.Spacing(14);

                    col.Item().Background(Colors.Blue.Lighten5).Padding(14).Column(c =>
                    {
                        c.Item().Text(headline).FontSize(14).Bold().FontColor(Colors.Blue.Darken3);
                        c.Item().PaddingTop(6).Column(b =>
                        {
                            foreach (var bullet in bullets)
                            {
                                b.Item().Row(r =>
                                {
                                    r.ConstantItem(14).Text("•").FontColor(Colors.Blue.Darken2);
                                    r.RelativeItem().Text(bullet).LineHeight(1.4f);
                                });
                            }
                        });
                    });

                    col.Item().PaddingTop(4).Text("Portfolio at a glance").FontSize(13).Bold();
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(3);
                            c.RelativeColumn(1);
                            c.RelativeColumn(1);
                            c.RelativeColumn(1);
                        });
                        t.Header(h =>
                        {
                            static IContainer Header(IContainer c) => c.DefaultTextStyle(ts => ts.Bold().FontColor(Colors.Grey.Darken2)).BorderBottom(1).BorderColor(Colors.Grey.Lighten2).PaddingVertical(6);
                            h.Cell().Element(Header).Text("Project");
                            h.Cell().Element(Header).AlignRight().Text("Tasks");
                            h.Cell().Element(Header).AlignRight().Text("High risk");
                            h.Cell().Element(Header).AlignRight().Text("Medium");
                        });
                        foreach (var p in projects)
                        {
                            t.Cell().PaddingVertical(4).Text(p.Name);
                            t.Cell().PaddingVertical(4).AlignRight().Text(p.TotalTasks.ToString());
                            t.Cell().PaddingVertical(4).AlignRight().Text(p.HighRisk.ToString()).FontColor(p.HighRisk > 0 ? Colors.Red.Darken2 : Colors.Grey.Darken1);
                            t.Cell().PaddingVertical(4).AlignRight().Text(p.MediumRisk.ToString()).FontColor(p.MediumRisk > 0 ? Colors.Orange.Darken2 : Colors.Grey.Darken1);
                        }
                    });
                });

                page.Footer().AlignCenter().Text(x =>
                {
                    x.Span("Simulyn AI · Predict. Explain. Act.   ").FontSize(9).FontColor(Colors.Grey.Darken1);
                    x.Span($"Generated {generatedAt:yyyy-MM-dd HH:mm} UTC").FontSize(9).FontColor(Colors.Grey.Lighten1);
                });
            });
        });

        return doc.GeneratePdf();
    }
}
