using Microsoft.EntityFrameworkCore;
using Simulyn.Api.Data;

namespace Simulyn.Api.Tests;

public static class TestFactory
{
    /// <summary>Fresh in-memory AppDbContext — one DB per test to keep them isolated.</summary>
    public static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"simulyn-test-{Guid.NewGuid()}")
            .Options;
        return new AppDbContext(options);
    }
}
