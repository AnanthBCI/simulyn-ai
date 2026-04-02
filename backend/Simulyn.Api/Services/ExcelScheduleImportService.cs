using System.Globalization;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;
using Simulyn.Api.Models.Dtos;
using Simulyn.Api.Models.Entities;

namespace Simulyn.Api.Services;

public class ExcelScheduleImportService(AppDbContext db)
{
    private static readonly string[] NameHeaders =
        ["task name", "task", "name", "activity", "description", "title", "wbs"];

    private static readonly string[] StartHeaders =
        ["start", "start date", "begin", "startdate", "planned start", "baseline start"];

    private static readonly string[] EndHeaders =
        ["end", "end date", "finish", "enddate", "planned finish", "baseline finish", "due"];

    private static readonly string[] ProgressHeaders =
        ["progress", "%", "percent", "pct", "complete", "completion", "% complete"];

    public async Task<ImportScheduleResultDto> ImportAsync(
        Guid projectId,
        Guid userId,
        Stream excelStream,
        CancellationToken ct = default)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && p.UserId == userId, ct);
        if (project == null)
            throw new InvalidOperationException("Project not found.");

        using var workbook = new XLWorkbook(excelStream);
        var sheet = workbook.Worksheets.FirstOrDefault()
                    ?? throw new InvalidOperationException("Workbook has no worksheets.");

        var range = sheet.RangeUsed();
        if (range == null)
            return new ImportScheduleResultDto(0, 0, ["Sheet is empty."]);

        var firstRow = range.FirstRow().RowNumber();
        var lastRow = range.LastRow().RowNumber();
        var firstCol = range.FirstColumn().ColumnNumber();
        var lastCol = range.LastColumn().ColumnNumber();

        var headers = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var c = firstCol; c <= lastCol; c++)
        {
            var raw = sheet.Cell(firstRow, c).GetString().Trim();
            if (string.IsNullOrEmpty(raw)) continue;
            var key = NormalizeHeader(raw);
            if (!headers.ContainsKey(key))
                headers[key] = c;
        }

        var nameCol = FindColumn(headers, NameHeaders);
        var startCol = FindColumn(headers, StartHeaders);
        var endCol = FindColumn(headers, EndHeaders);
        var progressCol = FindColumn(headers, ProgressHeaders);

        var messages = new List<string>();
        if (nameCol == null)
            throw new InvalidOperationException(
                "Could not find a task name column. Use a header such as \"Task Name\", \"Name\", or \"Activity\".");
        if (startCol == null)
            throw new InvalidOperationException(
                "Could not find a start date column. Use a header such as \"Start Date\" or \"Start\".");
        if (endCol == null)
            throw new InvalidOperationException(
                "Could not find an end date column. Use a header such as \"End Date\" or \"Finish\".");

        var created = 0;
        var skipped = 0;
        var now = DateTime.UtcNow;

        for (var r = firstRow + 1; r <= lastRow; r++)
        {
            var nameCell = sheet.Cell(r, nameCol.Value);
            var name = nameCell.GetString().Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                skipped++;
                continue;
            }

            var startCell = sheet.Cell(r, startCol.Value);
            var endCell = sheet.Cell(r, endCol.Value);

            if (!TryReadDate(startCell, out var startDate) || !TryReadDate(endCell, out var endDate))
            {
                messages.Add($"Row {r}: invalid or missing dates for \"{name}\" — skipped.");
                skipped++;
                continue;
            }

            if (endDate < startDate)
                (startDate, endDate) = (endDate, startDate);

            var progress = 0;
            if (progressCol != null)
            {
                var pCell = sheet.Cell(r, progressCol.Value);
                if (!TryReadPercent(pCell, out progress))
                    progress = 0;
            }

            var task = new ProjectTask
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                Name = name.Length > 300 ? name[..300] : name,
                StartDate = startDate,
                EndDate = endDate,
                Progress = Math.Clamp(progress, 0, 100),
                Status = "InProgress",
                CreatedAt = now
            };
            db.Tasks.Add(task);
            created++;
        }

        if (created > 0)
            await db.SaveChangesAsync(ct);

        messages.Insert(0, $"Imported {created} task(s); skipped {skipped} row(s).");
        return new ImportScheduleResultDto(created, skipped, messages);
    }

    private static string NormalizeHeader(string s) =>
        s.Trim().ToLowerInvariant().Replace("  ", " ");

    private static int? FindColumn(Dictionary<string, int> headers, IEnumerable<string> aliases)
    {
        foreach (var a in aliases)
        {
            var n = NormalizeHeader(a);
            if (headers.TryGetValue(n, out var col)) return col;
        }

        foreach (var kv in headers)
        {
            foreach (var a in aliases)
            {
                if (kv.Key.Contains(NormalizeHeader(a), StringComparison.OrdinalIgnoreCase))
                    return kv.Value;
            }
        }

        return null;
    }

    private static bool TryReadDate(IXLCell cell, out DateOnly date)
    {
        date = default;
        if (cell.IsEmpty()) return false;

        if (cell.DataType == XLDataType.DateTime)
        {
            var dt = cell.GetDateTime();
            date = DateOnly.FromDateTime(dt.Date);
            return true;
        }

        if (cell.DataType == XLDataType.Number)
        {
            try
            {
                var dt = cell.GetDateTime();
                date = DateOnly.FromDateTime(dt);
                return true;
            }
            catch
            {
                /* fall through */
            }
        }

        var s = cell.GetString().Trim();
        if (string.IsNullOrEmpty(s)) return false;

        if (DateOnly.TryParse(s, CultureInfo.CurrentCulture, DateTimeStyles.None, out date))
            return true;
        if (DateOnly.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out date))
            return true;

        if (DateTime.TryParse(s, CultureInfo.CurrentCulture, DateTimeStyles.None, out var dt2))
        {
            date = DateOnly.FromDateTime(dt2);
            return true;
        }

        return false;
    }

    private static bool TryReadPercent(IXLCell cell, out int percent)
    {
        percent = 0;
        if (cell.IsEmpty()) return false;

        if (cell.DataType == XLDataType.Number)
        {
            var n = cell.GetDouble();
            if (n <= 1 && n >= 0)
                percent = (int)Math.Round(n * 100);
            else
                percent = (int)Math.Round(n);
            return true;
        }

        var s = cell.GetString().Trim().TrimEnd('%').Trim();
        if (double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var d))
        {
            if (d <= 1 && d >= 0)
                percent = (int)Math.Round(d * 100);
            else
                percent = (int)Math.Round(d);
            return true;
        }

        return false;
    }
}
