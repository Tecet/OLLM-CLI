# Tools System Plan

## Reuse
- File tools, search tools, shell tool, web tools, memory tool, TODO tool.
- Tool registry, confirmation policy, and message bus.

## Tool Calling Adaptation
- Translate internal tool schemas to provider function formats.
- Parse provider tool call outputs into internal ToolCall objects.
- Use ReAct loop when provider lacks native tool calling.
- Enforce strict JSON parsing and schema validation.

## Safety and Policy
- Keep approval modes and confirmation UI.
- Keep diff preview for edit tools and shell command summaries.
- Continue sandbox and environment sanitization integration.

## Observability
- Log tool calls and results to session recorder.
- Expose tool events to debug console.
