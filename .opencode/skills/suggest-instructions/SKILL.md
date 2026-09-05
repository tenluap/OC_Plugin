---
name: suggest-instructions
description: Suggest instructional standards-and-guidelines skills from the skills.sh directory that should be installed for this repository (coding standards, framework conventions, review checklists), avoiding duplicates with already-installed skills and flagging installed ones whose upstream content changed. Use when the user asks for coding guidelines, standards, conventions, or best-practice references for the repo.
metadata:
  source: skills.sh
  ported-from: github/awesome-copilot suggest-awesome-github-copilot-instructions
---

# Suggest Instructional Skills from skills.sh

Analyze the current repository context and suggest instructional skills — standards, conventions, style guides, checklists — from the [skills.sh directory](https://skills.sh) that would serve this repository's stack, and that are not already available. In OpenCode, guidance lives either in installed skills (loaded on demand) or in `AGENTS.md` rules; this flow recommends skills, and notes when a suggestion is better expressed as a short `AGENTS.md` rule instead of a full skill.

## Process

1. **Analyze Context**: Determine languages (by file extensions), frameworks (manifests, config files), project type, and existing documentation (README, ADRs, style guides already in-repo).
2. **Scan Local Coverage**: Inventory what guidance already exists:
   - Installed skills: `.opencode/skills/*/SKILL.md`, `.agents/skills/*/SKILL.md`, `~/.config/opencode/skills/*/SKILL.md`, `.claude/skills/*/SKILL.md` — read front matter `name`/`description`.
   - Repo rules: `AGENTS.md` (and `CLAUDE.md`), `.github/copilot-instructions.md` if present.
   This inventory drives duplicate avoidance.
3. **Search the Directory**: Use `skills_sh_search` with queries pairing the stack with standards vocabulary (e.g. "typescript style guide", "python best practices", "api design guidelines", "accessibility checklist").
4. **Match & Filter**: Keep skills that are instructional (standards/conventions/checklists), match the actual stack, and are not duplicates. Skip opinionated frameworks the repo doesn't use.
5. **Outdated Check**: For installed skills sourced from skills.sh, call `skills_sh_detail` and compare the upstream SKILL.md/hash against the local copy; classify up-to-date / outdated (note what changed) / unverifiable.
6. **Present Options**: Output the structured table below. **AWAIT the user's explicit request before installing or updating anything. DO NOT INSTALL OR UPDATE UNLESS DIRECTED TO DO SO.**
7. **Install/Update on Request**: Run `skills_sh_audit` for each approved skill and surface warnings, then `skills_sh_install`. Install as-is; do not edit the downloaded SKILL.md. If a "skill" is really one short rule, offer instead to append a concise rule block to `AGENTS.md` and do only that on approval.
8. **Verify**: Re-scan the skill folders (or check the `AGENTS.md` diff) and report what landed where.

## Output Format

| skills.sh Skill | Description | Installs | Already Installed | Similar Local Guidance | Suggestion Rationale |
|-----------------|-------------|----------|-------------------|------------------------|---------------------|
| [ts-standards](https://skills.sh/owner/repo/ts-standards) | TypeScript conventions | 88k | ❌ No | None | Repo is TS with no standards doc |
| [python-style](https://skills.sh/owner/repo/python-style) | PEP8+ guidance | 120k | ✅ Yes | python-style | Already covered |
| [go-patterns](https://skills.sh/owner/repo/go-patterns) | Go idioms | 45k | ⚠️ Outdated | go-patterns | SKILL.md updated upstream — update recommended |

Icons reference:

- ✅ already installed and up-to-date
- ⚠️ installed but outdated (update available)
- ❌ not installed

## Requirements

- Use the `skills_sh_*` tools; do not fetch skills.sh pages by hand.
- Only suggest guidance matching the stack actually present in the repo; say when the repo has no coverage gap.
- Prefer skill installs for substantial guidance; prefer `AGENTS.md` rules for one-liners.
- Include skills.sh links, install counts, and any audit warnings.
- Keep output to the table plus at most a short preamble.
- Installation is consent-gated: table first, act only on the user's instruction.
