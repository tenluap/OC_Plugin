---
name: suggest-agents
description: Suggest OpenCode subagents worth creating for this repository based on skills found in the skills.sh directory and the project's stack and workflows, avoiding duplicates with existing agents and flagging agents whose source skill changed upstream. Use when the user asks which agents to add, wants role-based agents (reviewer, planner, tester), or asks to expand their agent roster.
metadata:
  source: skills.sh
  ported-from: github/awesome-copilot suggest-awesome-github-copilot-agents
---

# Suggest OpenCode Agents from skills.sh

Analyze the current repository context and propose OpenCode agents (markdown files in `.opencode/agents/`) worth creating, modeled on relevant skills from the [skills.sh directory](https://skills.sh). Unlike plain skill installs, an agent is a persona: a system prompt plus permission scoping that OpenCode can invoke as a subagent (via the Task tool or @mention) or switch to as a primary agent.

## Process

1. **Analyze Context**: Identify the project's languages, frameworks, project type, and recurring workflows (code review, testing, deployment, docs) from repo files and conversation history.
2. **Scan Local Agents**: Inventory existing agents via glob/read on `.opencode/agents/*.md` and `~/.config/opencode/agents/*.md`, extracting each file's front matter `description` (and `mode`). Also note built-ins (general, explore, scout, build, plan) so suggestions don't restate them.
3. **Search the Directory**: Use `skills_sh_search` with queries targeting agentic/role-shaped skills (e.g. "code review", "test driven development", "security review", "release notes"). skills.sh groups such skills under topics like Agent workflows.
4. **Design Candidates**: For each promising skill, sketch the agent it would become: name, one-line description, whether it should be a `subagent` (most cases) or a primary agent, and which tools it needs (read-only for reviewers, write for implementers).
5. **Dedupe**: Drop candidates that duplicate an existing agent's purpose or a built-in. Record near-duplicates in the table instead of suggesting them.
6. **Outdated Check**: For agents this plugin previously generated (their body cites a skills.sh source in a `source:` front matter note), call `skills_sh_detail` for the source skill and compare the SKILL.md content against the material the agent was built from; flag drift with ⚠️.
7. **Present Options**: Output the structured table below. **AWAIT the user's explicit request before creating any agent. DO NOT CREATE AGENTS UNLESS DIRECTED TO DO SO.**
8. **Create on Request**: For each approved agent, fetch the skill's SKILL.md (`skills_sh_detail`, or the raw GitHub fallback) and write `.opencode/agents/<agent-name>.md` with front matter `description`, `mode`, and (when scoping matters) `permission` entries, and a body that carries over the skill's instructions faithfully — adapted to OpenCode tool names, but do not invent new behaviors the skill doesn't describe. Record provenance in the body's first line: `<!-- generated from skills.sh <owner/repo/slug> on <date> -->`.
9. **Verify**: Re-scan `.opencode/agents/`, confirm each file's front matter parses (name matches filename: lowercase-hyphen), and report the new agents with how to invoke them (@mention or Task tool).

## Output Format

| Proposed Agent | Based on (skills.sh) | Description | Already Exists | Similar Existing Agent | Suggestion Rationale |
|----------------|----------------------|-------------|----------------|------------------------|----------------------|
| pr-reviewer | owner/repo/code-review | Read-only reviewer agent that audits diffs | ❌ No | None | No review persona exists for this repo |
| test-runner | owner/repo/vitest-tdd | Runs and repairs the test suite | ✅ Yes | test-runner | Already covered |
| release-manager | owner/repo/release-notes | Drafts releases from git history | ⚠️ Outdated | release-manager | Source skill changed upstream — regenerate recommended |

Icons reference:

- ✅ already exists and current
- ⚠️ exists but its source skill changed upstream
- ❌ does not exist yet

## Requirements

- Use the `skills_sh_*` tools for discovery and content; do not fabricate skill contents.
- Agents must follow OpenCode agent markdown conventions: YAML front matter (`description` required; `mode`, `model`, `temperature`, `permission` optional), body = system prompt, filename = agent name in lowercase-hyphen form.
- Default new agents to `mode: subagent` unless the user asks for a switchable primary agent.
- Keep output to the table plus at most a short preamble.
- Creation is consent-gated: table first, act only on the user's instruction.
