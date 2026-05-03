using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Simulyn.Api.Models.Dtos;

/// <summary>
/// One turn in the chat history as sent from the frontend. Mirrors the OpenAI
/// chat-completions message shape so the Python AI service can pass it through
/// almost unchanged. The frontend stores these in localStorage per active org.
/// </summary>
public record ChatMessageDto(
    string Role,                                // "user" | "assistant" | "system" | "tool"
    string? Content,                            // null when assistant emitted tool_calls
    List<ChatToolCallDto>? ToolCalls = null,    // assistant tool-calls
    string? ToolCallId = null,                  // for role=="tool" replies
    string? Name = null);                       // tool name on tool replies

public record ChatToolCallDto(
    string Id,
    string Name,
    JsonObject Arguments);

public record ChatRequestDto(
    string Message,                             // latest user message
    List<ChatMessageDto>? History = null);      // prior turns from the client (optional)

public record ChatUsedToolDto(string Name, JsonObject? Arguments);

public record ChatResponseDto(
    string Reply,
    List<ChatUsedToolDto> UsedTools,
    string? DetectedLanguage,
    string Provider,                            // "openai" | "anthropic" | "ollama" | "off"
    int IterationCount,
    bool Truncated);                            // true if the loop hit its cap

// --- Wire format between .NET orchestrator and Python /chat-step ---

public record ChatStepRequestDto(
    [property: JsonPropertyName("messages")] List<ChatMessageDto> Messages,
    [property: JsonPropertyName("available_tools")] List<ChatToolDefinitionDto> AvailableTools);

public record ChatToolDefinitionDto(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("parameters")] JsonObject Parameters);

public record ChatStepResponseDto(
    [property: JsonPropertyName("type")] string Type,                    // "tool_call" | "answer"
    [property: JsonPropertyName("tool_calls")] List<ChatToolCallDto>? ToolCalls,
    [property: JsonPropertyName("content")] string? Content,
    [property: JsonPropertyName("detected_language")] string? DetectedLanguage,
    [property: JsonPropertyName("provider")] string? Provider);
