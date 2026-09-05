---
description: Estimate token cost of skills, agents, tools, commands, and config before adding them to the project
agent: plan
subtask: true
---

You are auditing context-window cost. Token counts are estimates: divide character count by 4.

## Baseline (existing project + global setup)

!`echo "=== PROJECT .opencode ==="; find .opencode -type f 2>/dev/null | while read f; do c=$(wc -c < "$f"); echo "$((c/4)) tokens  $f"; done; echo; echo "=== GLOBAL ~/.config/opencode ==="; find ~/.config/opencode/skills ~/.config/opencode/commands ~/.config/opencode/agent ~/.config/opencode/plugin -type f 2>/dev/null | while read f; do c=$(wc -c < "$f"); echo "$((c/4)) tokens  $f"; done; echo; echo "=== CONFIG ==="; for cfg in opencode.json .opencode/opencode.json; do if [ -f "$cfg" ]; then c=$(wc -c < "$cfg"); echo "$((c/4)) tokens  $cfg"; fi; done`

## Candidate to evaluate

$ARGUMENTS

## Tasks

1. Summarise baseline: per-category totals (skills, agents, commands, plugins, config) and grand total.
2. If $ARGUMENTS names a file, directory, repo, or skill: read it, estimate its token count (chars/4), and show what it would add.
3. If opencode.json declares MCP servers, note that each server's tools inject schemas and descriptions into context at session start — estimate added cost per server from its config size and tool count if discoverable, otherwise flag as unmeasured.
4. Flag any single item over 1,000 tokens and any candidate pushing total additions over 5,000 tokens.
5. Recommend: add, trim, or skip — one line of reasoning each.

Output a compact table plus the recommendation. No preamble.