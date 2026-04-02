namespace Simulyn.Api.Models.Dtos;

public record ImportScheduleResultDto(
    int TasksCreated,
    int RowsSkipped,
    IReadOnlyList<string> Messages);
