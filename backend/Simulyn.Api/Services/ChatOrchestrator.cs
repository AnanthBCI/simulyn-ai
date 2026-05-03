using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Simulyn.Api.Models.Dtos;

namespace Simulyn.Api.Services;

/// <summary>
/// Drives the chat copilot's tool-calling loop. The Python AI service is the LLM
/// brain — this class is the agent runtime: it sends history+tools to Python,
/// receives either a tool_call or a final answer, executes the tool in-process
/// against the org's data, appends the result, and loops until done or capped.
/// </summary>
public class ChatOrchestrator(
    AiClientService ai,
    ChatTools tools,
    ILogger<ChatOrchestrator> logger)
{
    /// <summary>Max tool-call iterations per user turn. Prevents runaway costs / loops.</summary>
    public const int MaxIterations = 6;

    /// <summary>Cap on how many prior turns we ship to the LLM (keeps tokens tight).</summary>
    public const int MaxHistoryTurns = 8;

    public async Task<ChatResponseDto> RunAsync(
        ChatRequestDto request,
        Guid orgId,
        Guid userId,
        string activeOrgName,
        string userName,
        CancellationToken ct)
    {
        var messages = BuildInitialMessages(request, activeOrgName, userName);
        var usedTools = new List<ChatUsedToolDto>();
        var truncated = false;
        string provider = "off";
        string? detectedLanguage = null;

        for (var i = 0; i < MaxIterations; i++)
        {
            var step = await ai.ChatStepAsync(
                new ChatStepRequestDto(messages, ChatTools.Definitions.ToList()),
                ct);

            if (step is null)
            {
                return new ChatResponseDto(
                    Reply: "Sorry — the AI service is not reachable right now. Try again in a moment.",
                    UsedTools: usedTools,
                    DetectedLanguage: null,
                    Provider: provider,
                    IterationCount: i,
                    Truncated: false);
            }

            provider = step.Provider ?? provider;
            detectedLanguage = step.DetectedLanguage ?? detectedLanguage;

            if (step.Type == "answer" || (step.ToolCalls is null or { Count: 0 }))
            {
                var content = string.IsNullOrWhiteSpace(step.Content)
                    ? "I don't have an answer for that yet."
                    : step.Content!;
                return new ChatResponseDto(
                    Reply: content,
                    UsedTools: usedTools,
                    DetectedLanguage: detectedLanguage,
                    Provider: provider,
                    IterationCount: i + 1,
                    Truncated: false);
            }

            // Append the assistant tool_call message, then execute each tool and
            // append the corresponding tool reply. This mirrors the OpenAI pattern.
            messages.Add(new ChatMessageDto(
                Role: "assistant",
                Content: null,
                ToolCalls: step.ToolCalls));

            foreach (var call in step.ToolCalls)
            {
                usedTools.Add(new ChatUsedToolDto(call.Name, call.Arguments));
                JsonNode? result;
                try
                {
                    result = await tools.ExecuteAsync(call.Name, call.Arguments, orgId, userId, ct);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Chat tool {Tool} failed", call.Name);
                    result = JsonValue.Create(new { error = $"Tool '{call.Name}' failed: {ex.Message}" });
                }

                messages.Add(new ChatMessageDto(
                    Role: "tool",
                    Content: result?.ToJsonString(JsonSerializerOptions.Default) ?? "{}",
                    ToolCalls: null,
                    ToolCallId: call.Id,
                    Name: call.Name));
            }
        }

        // Hit the iteration cap — ask the LLM for a best-effort summary of what we have.
        truncated = true;
        var summaryStep = await ai.ChatStepAsync(
            new ChatStepRequestDto(
                messages.Concat(new[]
                {
                    new ChatMessageDto(
                        Role: "user",
                        Content: "Stop calling tools and answer the original question with the data you've already retrieved. " +
                                 "If something is missing, say so briefly.",
                        ToolCalls: null),
                }).ToList(),
                ChatTools.Definitions.ToList()),
            ct);

        var finalReply = summaryStep?.Content
            ?? "I gathered some data but ran out of lookups before I could finish. Try asking a more specific question.";
        return new ChatResponseDto(
            Reply: finalReply,
            UsedTools: usedTools,
            DetectedLanguage: detectedLanguage,
            Provider: provider,
            IterationCount: MaxIterations,
            Truncated: truncated);
    }

    private static List<ChatMessageDto> BuildInitialMessages(
        ChatRequestDto request,
        string activeOrgName,
        string userName)
    {
        var systemMessage = new ChatMessageDto(
            Role: "system",
            Content:
                "You are Simulyn AI, a construction project copilot. " +
                "You help project managers understand their portfolio of projects, tasks, " +
                "AI-generated risk predictions, and alerts.\n\n" +
                $"Active organization: \"{activeOrgName}\". User: {userName}. " +
                $"Today's date: {DateTime.UtcNow:yyyy-MM-dd} (UTC).\n\n" +
                "Tool-calling rules (read carefully):\n" +
                "A. When you need to call a tool, use the structured tool-calling mechanism only. " +
                "NEVER write tool calls as plain text in your reply. Do NOT output JSON like " +
                "`{\"name\": \"list_projects\", ...}` to the user — that is an internal protocol, not user-facing text.\n" +
                "B. Only call a tool when the user is asking about specific data in their Simulyn workspace " +
                "(projects, tasks, predictions, alerts, members, organizations). For greetings (\"hi\", \"hello\", \"thanks\"), " +
                "small talk, or generic questions about how Simulyn works, just answer directly with NO tool call.\n" +
                "C. Never invent project names, task names, dates, percentages, risk levels or counts. " +
                "Every fact must come from a tool result you actually received in this conversation.\n" +
                "D. If a tool returns `count: 0`, an empty list, or a `message` saying nothing was found, " +
                "tell the user plainly that there are none. Do NOT fabricate example items to 'fill in'. " +
                "If risk data is empty, suggest they open a project and click \"Run prediction (all tasks)\" first.\n" +
                "E. If a tool returns an `error` field, briefly relay the error and suggest a next step. Never invent data to recover.\n\n" +
                "Style:\n" +
                "1. Reply in the same language the user wrote in. Format dates and numbers naturally for that language.\n" +
                "2. Be concise: under 6 sentences unless the user explicitly asks for detail.\n" +
                "3. Cite project and task names when referring to them. Use bullet points for lists of 3+ items.\n" +
                "4. You cannot create, edit, or delete data. If asked, explain that you're a read-only assistant in v1 and point to the relevant screen.",
            ToolCalls: null);

        var messages = new List<ChatMessageDto> { systemMessage };

        // Trim prior history to the most recent N turns. We never drop the new user message.
        var prior = (request.History ?? new List<ChatMessageDto>())
            .Where(m => m.Role is "user" or "assistant" or "tool")
            .ToList();
        var trimmed = prior.Count > MaxHistoryTurns
            ? prior.Skip(prior.Count - MaxHistoryTurns).ToList()
            : prior;
        messages.AddRange(trimmed);

        // Append the new user message.
        if (!string.IsNullOrWhiteSpace(request.Message))
        {
            messages.Add(new ChatMessageDto(
                Role: "user",
                Content: request.Message,
                ToolCalls: null));
        }

        return messages;
    }
}
