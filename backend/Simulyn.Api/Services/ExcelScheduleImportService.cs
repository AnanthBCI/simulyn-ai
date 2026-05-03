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
        Guid organizationId,
        Stream excelStream,
        CancellationToken ct = default)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && p.OrganizationId == organizationId, ct);
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

    /// <summary>
    /// Builds a starter .xlsx workbook the user can download, fill in, and re-upload.
    /// Sheet 1: a "Schedule" sheet with the four expected columns and ~8 realistic
    /// construction tasks dated relative to today, so it doubles as a quick demo.
    /// Sheet 2: an "Instructions" sheet listing the header aliases the importer accepts.
    /// </summary>
    public static byte[] BuildTemplate()
    {
        using var workbook = new XLWorkbook();
        BuildScheduleSheet(workbook);
        BuildInstructionsSheet(workbook);

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }

    private static void BuildScheduleSheet(XLWorkbook workbook)
    {
        var sheet = workbook.Worksheets.Add("Schedule");

        // Headers
        sheet.Cell(1, 1).Value = "Task Name";
        sheet.Cell(1, 2).Value = "Start Date";
        sheet.Cell(1, 3).Value = "End Date";
        sheet.Cell(1, 4).Value = "Progress";

        var headerRange = sheet.Range(1, 1, 1, 4);
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Fill.BackgroundColor = XLColor.FromHtml("#1f2937");
        headerRange.Style.Font.FontColor = XLColor.White;
        headerRange.Style.Border.BottomBorder = XLBorderStyleValues.Medium;

        // Sample rows — a realistic 8-task construction project starting today.
        // Mix of completed / in-progress / not-started so AI predictions show variety.
        var today = DateTime.Today;
        var samples = new (string name, int startOffset, int durationDays, int progress)[]
        {
            ("Site mobilization & temporary facilities", -45, 14, 100),
            ("Excavation & shoring",                    -30, 21,  90),
            ("Foundation pour — mat slab",              -10, 18,  60),
            ("Structural steel erection — L1-L4",         5, 30,  10),
            ("MEP rough-in — L1-L4",                    20, 35,   0),
            ("Curtain wall installation",               40, 45,   0),
            ("Interior finishes — L1-L4",               60, 50,   0),
            ("Final inspections & punch list",         110, 14,   0),
        };

        var row = 2;
        foreach (var (name, startOffset, durationDays, progress) in samples)
        {
            sheet.Cell(row, 1).Value = name;
            sheet.Cell(row, 2).Value = today.AddDays(startOffset);
            sheet.Cell(row, 3).Value = today.AddDays(startOffset + durationDays);
            sheet.Cell(row, 4).Value = progress;

            sheet.Cell(row, 2).Style.DateFormat.Format = "yyyy-mm-dd";
            sheet.Cell(row, 3).Style.DateFormat.Format = "yyyy-mm-dd";
            sheet.Cell(row, 4).Style.NumberFormat.Format = "0\"%\"";
            row++;
        }

        sheet.Columns(1, 4).AdjustToContents();
        sheet.Column(1).Width = Math.Max(sheet.Column(1).Width, 42);
        sheet.SheetView.FreezeRows(1);

        // Helpful note in row 11
        sheet.Cell(11, 1).Value = "Replace the example rows above with your own tasks, then upload this file in Simulyn.";
        sheet.Cell(11, 1).Style.Font.Italic = true;
        sheet.Cell(11, 1).Style.Font.FontColor = XLColor.FromHtml("#6b7280");
        sheet.Range(11, 1, 11, 4).Merge();
    }

    private static void BuildInstructionsSheet(XLWorkbook workbook)
    {
        var sheet = workbook.Worksheets.Add("Instructions");

        sheet.Cell(1, 1).Value = "How to use this template";
        sheet.Cell(1, 1).Style.Font.Bold = true;
        sheet.Cell(1, 1).Style.Font.FontSize = 14;

        var lines = new[]
        {
            "1. Open the 'Schedule' sheet.",
            "2. Replace the example rows with your own tasks (one task per row).",
            "3. Save the file (.xlsx) and upload it on the project page in Simulyn.",
            "",
            "Accepted column headers — any one of these is recognised:",
            "",
            "  Task name:    Task Name, Task, Name, Activity, Description, Title, WBS",
            "  Start date:   Start, Start Date, Begin, Planned Start, Baseline Start",
            "  End date:     End, End Date, Finish, Due, Planned Finish, Baseline Finish",
            "  Progress (%): Progress, %, Percent, Pct, Complete, Completion, % Complete",
            "",
            "Column order doesn't matter — the importer looks at the header text in row 1.",
            "Dates may be Excel date cells or text in yyyy-MM-dd format.",
            "Progress can be a number 0–100 or a 0–1 decimal (e.g. 0.75 means 75%).",
            "",
            "After upload, AI risk predictions run automatically for every imported task.",
        };

        for (var i = 0; i < lines.Length; i++)
        {
            sheet.Cell(i + 3, 1).Value = lines[i];
        }

        sheet.Column(1).Width = 90;
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
