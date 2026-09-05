---
name: suggest-skills
description: Suggest relevant agent skills from the skills.sh directory (skills.sh) based on current repository context and conversation, avoiding duplicates with skills already installed in this project, and identifying installed skills whose upstream content is outdated. Use when the user asks to discover, recommend, compare, install, or update skills.
metadata:
  source: skills.sh
  ported-from: github/awesome-copilot suggest-awesome-github-copilot-skills
---

# Suggest Skills from skills.sh

Analyze the current repository context and suggest relevant agent skills from the [skills.sh directory](https://skills.sh) that are not already available in this project. skills.sh indexes community skills slugged `owner/repo/skill-name`; installs run through the official skills CLI (`npx skills add`).

## Process

1. **Analyze Context**: Review conversation history and repository files for the project's language, frameworks, project type, and workflow needs.
2. **Scan Local Skills**: Build an inventory of skills already available to OpenCode by scanning, via glob/read:
   - `.opencode/skills/*/SKILL.md` (project)
   - `.agents/skills/*/SKILL.md` (where the skills CLI installs for OpenCode)
   - `~/.config/opencode/skills/*/SKILL.md` (global)
   - `.claude/skills/*/SKILL.md` (Claude-compatible location OpenCode also reads)
   For each, read the front matter `name` and `description`. This inventory drives duplicate avoidance.
3. **Search the Directory**: Use the `skills_sh_search` tool with 2–4 focused queries derived from the context (e.g. "terraform azure", "react testing"). Use `view=trending`/`view=curated` only when the user wants a survey rather than targeted matches.
4. **Match Relevance**: Compare search results against the identified needs. Discard skills that are off-topic, flagged duplicates (`isDuplicate`), or thin (few installs AND vague description) unless the user asked for exhaustive results.
5. **Dedupe**: For each candidate, check the local inventory for an existing skill with the same name or clearly overlapping scope. Matching by scope beats matching by name — note the overlap in the rationale column.
6. **Outdated Check**: For locally installed skills that came from skills.sh, call `skills_sh_detail` and compare the returned `hash`/SKILL.md content against the local copy. Classify each as up-to-date (matches), outdated (differs — note what changed: description, instructions, assets), or unverifiable.
7. **Present Options**: Output the structured table below. **AWAIT the user's explicit request before installing or updating anything. DO NOT INSTALL OR UPDATE UNLESS DIRECTED TO DO SO.**
8. **Install/Update on Request**: For each approved skill, run the `skills_sh_audit` tool first and surface any `warn`/`fail` results before installing, then run `skills_sh_install` (which shells out to `npx skills add <owner/repo> -y --agent opencode`). Do not modify the skill files after install — install them as-is. For updates, re-run `skills_sh_install` for the same source.
9. **Verify**: Re-scan the local skill folders and confirm each requested skill now exists; report anything that failed with the CLI output.

## Output Format

| skills.sh Skill | Description | Installs | Already Installed | Similar Local Skill | Suggestion Rationale |
|-----------------|-------------|----------|-------------------|---------------------|---------------------|
| [find-skills](https://skills.sh/vercel-labs/skills/find-skills) | Helps discover skills | 3.3M | ❌ No | None | Fills the discovery gap for this repo |
| [example-skill](https://skills.sh/owner/repo/example-skill) | React testing helpers | 12k | ✅ Yes | example-skill | Already covered |
| [another-skill](https://skills.sh/owner/repo/another-skill) | Linting standards | 40k | ⚠️ Outdated | another-skill | SKILL.md updated upstream — update recommended |

Icons reference:

- ✅ already installed and up-to-date
- ⚠️ installed but outdated (update available)
- ❌ not installed

## Requirements

- Use the `skills_sh_search`, `skills_sh_detail`, `skills_sh_audit`, and `skills_sh_install` tools — do not hand-roll `curl` calls against skills.sh.
- Never suggest a skill whose scope is already covered by the local inventory without saying so explicitly.
- Include the skills.sh page link and install count for every suggestion; note any security-audit warnings.
- Keep output to the table plus at most a short preamble — no extra essays.
- Installation is consent-gated: table first, act only on the user's instruction.
