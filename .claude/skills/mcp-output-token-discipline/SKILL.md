---
name: mcp-output-token-discipline
description: >
  Cut invisible token load from MCP tool schemas and from huge shell outputs. Use when the user
  mentions MCP servers, too many tools, disconnect MCP, CLI vs MCP, bash output bloat, git log
  flooding context, or "tokens from tools". Claude Code and Cursor both benefit; numbers in body
  are illustrative from the source talk, not guarantees.
license: Proprietary
compatibility: "Claude Code & Cursor: MCP toggles in settings. Terminal command output affects any agent that injects full stdout into context."
---

# MCP & command-output discipline

## Source

Nate Herk transcript — MCP definitions re-injected each turn; large **command stdout** enters context.

## MCP

1. **Disable servers** not needed for the current task (both IDEs).
2. Prefer **narrow tool sets** or **CLI** for heavy integrations when the talk suggests it (e.g. calendar/workspace) — validate per project; do not remove MCP the user still needs.
3. When the user asks *why* context is huge, mention **tool definition overhead** as a common cause.

## Shell / tool output

1. Before running noisy commands (`git log` wide, massive tests), **narrow** flags (`--oneline`, `-n`, filters).
2. If output is large, **summarise in the tool response** or write to a **file** and point to path instead of pasting megabytes into chat.
3. Use project **permissions / deny lists** where the product supports blocking known-noisy commands.
4. Never truncate error output, failing-test output, or code needed to reason about a bug; narrow noisy output only when it is not needed for diagnosis.

## Honesty

- Do **not** cite fixed token counts per server unless measured in *this* session; the talk gave **order-of-magnitude examples** only.
