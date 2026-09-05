# awesome-skills for OpenCode

A native OpenCode port of GitHub's [`awesome-copilot`](https://github.com/github/awesome-copilot) plugin — the same meta workflow (discover → dedupe → outdated-check → consent → install), rebuilt for OpenCode's extension points and re-sourced from **[skills.sh](https://skills.sh)**, Vercel's Agent Skills Directory, instead of the awesome-copilot repository and its Dockerized MCP server.

## What it gives OpenCode

| Source plugin (Copilot) | This port (OpenCode) |
|---|---|
| `suggest-awesome-github-copilot-skills` skill | `suggest-skills` skill — recommends skills.sh skills for your repo, dedupes against installed skills, flags outdated ones, installs on approval |
| `suggest-awesome-github-copilot-agents` skill | `suggest-agents` skill — proposes OpenCode agents (`.opencode/agents/*.md`) modeled on skills.sh skills, deduped against existing agents |
| `suggest-awesome-github-copilot-instructions` skill | `suggest-instructions` skill — proposes standards/guidelines skills (or short `AGENTS.md` rules) for your stack |
| `/suggest-*` slash commands (4) | `/suggest-skills`, `/suggest-agents`, `/suggest-instructions`, `/scaffold` commands |
| `meta-agentic-project-scaffold` agent | Same agent, rewritten for skills.sh + OpenCode folders |
| Dockerized MCP server (`mcp.json`) | Four native custom tools (`skills_sh_search`, `skills_sh_detail`, `skills_sh_audit`, `skills_sh_install`) — no Docker, no MCP |
| Source: github/awesome-copilot repo | Source: skills.sh catalog (`owner/repo/skill-name`, `npx skills add`, REST API) |

Everything the source plugin did through its MCP server is done here through OpenCode custom tools; all outbound requests are HTTPS-only to an allowlist (`skills.sh`, `raw.githubusercontent.com`) with localhost/private/reserved-address rejection.

## Layout

```
.opencode/
├── tools/                    # custom tools (filename = tool name)
│   ├── skills_sh_search.ts   # search / leaderboard / curated listing
│   ├── skills_sh_detail.ts   # one skill: installs, upstream hash, SKILL.md
│   ├── skills_sh_audit.ts    # security audits (Socket, Snyk, Trust Hub, …)
│   └── skills_sh_install.ts  # consent-gated `npx skills add -y --agent opencode`
├── skills/
│   ├── suggest-skills/SKILL.md
│   ├── suggest-agents/SKILL.md
│   └── suggest-instructions/SKILL.md
├── agents/
│   └── meta-agentic-project-scaffold.md
├── commands/                 # /suggest-skills /suggest-agents /suggest-instructions /scaffold
├── plugins/awesome-skills.ts # plugin entry (session logging for installs)
├── lib/skills-sh.ts          # shared allowlisted HTTPS client (imported by tools)
└── package.json              # dep on @opencode-ai/plugin for local tools
```

Directory names follow the current OpenCode convention (plural: `plugins/`, `tools/`, `commands/`, `agents/`, `skills/`) — requires OpenCode 1.18 or newer.

`lib/` is not a scanned OpenCode directory — it only backs the tools' `../lib/skills-sh` import, which is why `install.sh` copies it alongside everything else.

## Install

Full per-platform instructions (macOS, Windows, Linux/WSL, PowerShell, token setup, uninstall) live in [INSTALL.md](INSTALL.md). Short version:

```bash
bash install.sh /path/to/your/project   # project scope -> <project>/.opencode/**
bash install.sh --global                # global scope  -> ~/.config/opencode/**
bash install.sh --check                 # doctor: verify prerequisites, change nothing
bash install.sh --uninstall /path/to/your/project   # remove only this extension's files
```

Prerequisites: OpenCode 1.18+, plus Node.js 18+ (with `npx`) and git for the skills CLI. Re-running the installer is safe (directories merge, files overwrite). Then restart OpenCode. The four tools appear alongside built-ins; the three skills appear in the `skill` tool's available list; `/suggest-skills` etc. appear in the command palette; the agent is invokable via `@meta-agentic-project-scaffold` or Tab (it declares `mode: all`).

Optional token: the skills.sh REST API requires a Vercel OIDC token. Export `VERCEL_OIDC_TOKEN` (or `SKILLS_SH_TOKEN`) to enable it. Without a token, `skills_sh_search` falls back to the public `skills` CLI (`npx skills find`), `skills_sh_detail` falls back to `raw.githubusercontent.com`, and `skills_sh_install` always works (the CLI needs no token).

## Usage

- `/suggest-skills` — get a deduped recommendation table for this repo, then approve installs by name.
- `/scaffold nextjs testing` — let the scaffold agent pull a starter set of skills/agents/commands into the right folders.
- Direct tool calls: `skills_sh_search(query: "terraform azure")`, `skills_sh_audit(skill: "owner/repo/slug")`, …

Consent gate: every suggest flow ends in a table and **waits** — nothing is installed or updated until you say so, matching the source plugin's behavior.

## Design notes

- **Install path**: the official skills CLI installs for OpenCode into `.agents/skills/` (project) or `~/.config/opencode/skills/` (global) — both are valid OpenCode skill locations per the [skills docs](https://opencode.ai/docs/skills/).
- **Outdated checks**: the API exposes a SHA-256 content `hash` per skill; without a token the tools diff the upstream `SKILL.md` from raw.githubusercontent.com instead.
- **npm packaging**: OpenCode plugin *packages* extend OpenCode through the hooks/tool object only; skills/commands/agents are filesystem-loaded, so this repo ships as an OpenCode project overlay (what `install.sh` copies) rather than a single npm module. `plugins/awesome-skills.ts` is the npm-entry seed if you later want to publish the tools programmatically.
- **Security**: skills are installed as-is (never edited post-install, per the source plugin), audit results are surfaced before install, and all HTTP egress passes an SSRF guard (allowlist + private/reserved IP rejection).

Ported from [github/awesome-copilot](https://github.com/github/awesome-copilot) (MIT). Skills sourced from [skills.sh](https://skills.sh) / [vercel-labs/skills](https://github.com/vercel-labs/skills). MIT license.
