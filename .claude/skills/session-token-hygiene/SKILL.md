---
name: session-token-hygiene
description: >
  Manage Claude Code and Cursor session costs through smart compaction timing and conversation
  hygiene. Use this skill whenever the user mentions: token usage, hitting context limit, /compact,
  /clear, auto-compact, "60% context", degraded memory, long session, unrelated task in same chat,
  batching prompts, context window, cost per session, slash clear, plan mode, edit-and-regenerate,
  context compounding, or session cost. Covers WHEN to compact (before 95%), HOW to compact
  (preserve the right things), and structural habits that cut cost across the whole session.
  Complements model-routing (model tier selection) — this skill handles session structure.
license: Proprietary
compatibility: "Claude Code: /context, /compact, /clear, plan mode. Cursor: New Chat + pasted summary; Composer plan; edit prior message where UI allows."
---

# Session token hygiene

## Source
Both sections derived from Nate Herk, *18 Claude Code Token Hacks* (YouTube, Apr 2026),
local transcript `nate-herk_49V-5Ock8LU_transcript_2026-04.txt`.
The ~60% compaction threshold is a **heuristic** from that talk, not an Anthropic guarantee.

---

## Part 1 — Compaction timing (Claude Code)

### When to compact
Do not wait for auto-compact (~95%). Compact proactively at **~55–65% utilisation**.
Check with `/context` or the status line.

### How to compact
Run `/compact` with **explicit preservation instructions**:
- Keep: current task goal, open files, decisions made, failing tests, next 3 steps
- Always keep (Luxardo): payment/stock invariants (server-authoritative pricing in paise, stock reserve/release-once, webhook and verify idempotency, order-state rules), exact failing-test output/evidence, and open blockers
- Compact only at a safe task boundary (after a commit/verified step), never mid-debug of a failing test
- Drop: exploratory digressions, duplicate tool output, resolved sub-threads

Without explicit instructions, `/compact` silently loses decisions you care about.

### Session reset rule
After **3–4 compacts** in one session, compounding degrades quality. Stop — run `/clear`,
paste a short session summary (goal + decisions + active blockers), continue fresh.

### Break rule
If stepping away >5 minutes mid-task, consider `/compact` or `/clear` before returning.
Prompt cache behaviour can change after a break.

### Cursor equivalent
No `/compact` command. Create a **new chat**, inject a 1-page summary:
goal, constraints, file paths, undone work. Keep pasted excerpts small (function/section, not whole repo).

### Anti-patterns
- Compacting without telling the model what to keep
- Chaining many compacts without ever clearing

---

## Part 2 — Conversation hygiene

### 1. New conversation per topic
Unrelated task → `/clear` (Claude Code) or new chat (Cursor). Carrying Topic A into Topic B
multiplies cost — every turn pays for full history.

### 2. Batch steps in one message
Prefer one message: *summarise → extract issues → propose fix* instead of three turns,
**when quality allows**. For subtle, high-stakes tasks, smaller steps can be justified —
state the trade-off explicitly.

### 3. Plan before expensive execution
Use plan mode (or an explicit plan in the message) so the model does not burn tokens on wrong paths.

### 4. Edit instead of stacking corrections
Where the product supports it, **edit the prior user message** and regenerate rather than
appending a long corrective thread.

### 5. Surgical pastes
Paste **function / paragraph / section**, not whole files or repos, unless the task requires it.

### 6. Supervise long runs
Stop loops early when they take a wrong path or repeat file reads — same rationale as plan-first.

### Visibility (Claude Code)
Use `/context` and `/cost` when the user asks where tokens are going.
MCP tool definitions add overhead on every turn — see `mcp-output-token-discipline` skill.

### Cursor notes
No `/cost`. Apply batching, new chat, small selections, plan-first — all still effective.
