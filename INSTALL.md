# Installing awesome-skills for OpenCode

awesome-skills is distributed as an **OpenCode project overlay**: a set of directories that get copied into a project's `.opencode/` (project scope) or into your user config directory (global scope). There is no build step and no Docker/MCP server — after copying, OpenCode picks everything up on the next start.

## What gets installed

| Item | Destination (project scope) | Destination (global scope) |
|---|---|---|
| `tools/` (4 custom tools) | `<project>/.opencode/tools/` | `~/.config/opencode/tools/` |
| `skills/` (3 suggest skills) | `<project>/.opencode/skills/` | `~/.config/opencode/skills/` |
| `commands/` (4 slash commands) | `<project>/.opencode/commands/` | `~/.config/opencode/commands/` |
| `agents/` (scaffold agent) | `<project>/.opencode/agents/` | `~/.config/opencode/agents/` |
| `plugins/` (log hook) | `<project>/.opencode/plugins/` | `~/.config/opencode/plugins/` |
| `lib/`, `package.json`, `bun.lock` | alongside the above | alongside the above |

`lib/` is inert for OpenCode (not a scanned directory) — it only backs the tools' `../lib/skills-sh` import, so it must travel with `tools/`. `package.json` + `bun.lock` pin the plugin dependency (`@opencode-ai/plugin` 1.18.29); OpenCode runs the dependency install itself at startup. If the target scope already has a `package.json` with other dependencies (common for the global scope), the installer **merges** the dependency sets instead of replacing them, so other plugins keep working.

## Prerequisites (all platforms)

1. **OpenCode** — see [opencode.ai/docs](https://opencode.ai/docs/). Quick per-platform options:
   - macOS / Linux: `curl -fsSL https://opencode.ai/install | bash`, or `brew install anomalyco/tap/opencode` (Arch: `sudo pacman -S opencode`)
   - Windows: `choco install opencode`, `scoop install opencode`, or `npm install -g opencode-ai`. **WSL is the recommended Windows path** per the OpenCode docs ("better performance and full compatibility") — under WSL, follow the Linux instructions below.
2. **Node.js 18+ (with `npx`) and git** — the install tool shells out to the official skills CLI (`npx skills add`), which resolves skills from GitHub.
3. Network access to `skills.sh`, `raw.githubusercontent.com`, and `github.com` (the client's allowlisted hosts).

Bun itself is **not** required: OpenCode bundles it and installs the plugin dependency at startup. (If that ever fails on your machine, see Troubleshooting → "Dependency install fails".)

## macOS & Linux

```bash
# Project scope — recommended; assets travel with the repo
bash install.sh /path/to/your/project

# Global scope — available in every project for your user
bash install.sh --global          # -> ~/.config/opencode/

# Verify prerequisites without changing anything / remove the extension
bash install.sh --check
bash install.sh --uninstall /path/to/your/project   # or --uninstall --global
```

Re-running an install is safe: directories are merged and files overwritten, never nested.

There is no build step. If your shell complains about an execute bit, run it with `bash install.sh …` as shown (do not `chmod` it first — `bash` does not need it).

## Windows

Pick one of the three options — A is the docs-recommended path.

### Option A — WSL (recommended)

Install OpenCode inside WSL (Ubuntu/Debian) and follow the **macOS & Linux** section above verbatim; WSL and Windows share nothing else.

### Option B — Git Bash

Git for Windows ships a bash that runs the installer unchanged:

```bash
bash install.sh "C:/path/to/your/project"    # project scope
bash install.sh --global                     # global scope -> %USERPROFILE%\.config\opencode
```

### Option C — native PowerShell (no bash at all)

```powershell
$src  = "C:\path\to\OC_Plugin\.opencode"
# Project scope:
$dest = "C:\path\to\your\project\.opencode"
# …or global scope:
# $dest = "$env:USERPROFILE\.config\opencode"

New-Item -ItemType Directory -Force -Path $dest | Out-Null
foreach ($item in "tools","skills","commands","agents","plugins","lib","package.json","bun.lock") {
    Copy-Item -Recurse -Force -Path (Join-Path $src $item) -Destination (Join-Path $dest $item)
}
```

Note on the global path on Windows: OpenCode uses the same `~/.config/opencode` layout on every OS, i.e. `%USERPROFILE%\.config\opencode` — create it if it does not exist yet (the snippet above does).

## Post-install

1. **Restart OpenCode** in the project (or anywhere, for global scope) so the new tools, skills, commands, and agent load.
2. On first start OpenCode installs the pinned dependency from `.opencode/package.json` (one-time, a few seconds).
3. Verify:
   - `/suggest-skills`, `/suggest-agents`, `/suggest-instructions`, `/scaffold` appear in the command palette;
   - the `skill` tool lists `suggest-skills`, `suggest-agents`, `suggest-instructions`;
   - tools `skills_sh_search`, `skills_sh_detail`, `skills_sh_audit`, `skills_sh_install` are available;
   - `@meta-agentic-project-scaffold` can be @mentioned (the agent is `mode: all`, so Tab also cycles to it).

## Optional: skills.sh API token

The skills.sh REST API requires a Vercel OIDC token; without one the plugin still works (search falls back to the `skills` CLI, detail to raw GitHub, install and audits need nothing). To enable first-class search:

```bash
# macOS / Linux / WSL / Git Bash (current session)
export VERCEL_OIDC_TOKEN="<token>"
# persist: add the line to ~/.zshrc / ~/.bashrc
```

```powershell
# Windows PowerShell — current session
$env:VERCEL_OIDC_TOKEN = "<token>"
# persist for future sessions
setx VERCEL_OIDC_TOKEN "<token>"
```

`SKILLS_SH_TOKEN` is accepted as an alias. Token source and rotation details: [skills.sh/docs/api](https://skills.sh/docs/api#authentication).

## Usage

```text
/suggest-skills terraform and azure          # deduped recommendation table, installs on your approval
/scaffold next.js testing and CI             # scaffold agent pulls skills/agents/commands into place
skills_sh_search(query: "react testing")     # direct tool call
skills_sh_audit(skill: "owner/repo/slug")    # Socket/Snyk/Trust Hub results before installing
```

One path distinction worth knowing: the table above is the **plugin's own files**. Skills you later install *through* the plugin go through the official skills CLI and land in `.agents/skills/` (project) or `~/.config/opencode/skills/` (global) — both are valid OpenCode skill locations that OpenCode reads automatically.

## Uninstall

Delete what was copied — nothing else is modified:

```bash
# project scope
bash install.sh --uninstall /path/to/your/project
# global scope
bash install.sh --uninstall --global
```

The uninstaller removes only this extension's files (the `skills_sh_*` tools, `suggest-*` skills/commands, the scaffold agent, the plugin entry, and `lib/`); anything else already in those directories survives. The `.opencode/package.json` + `bun.lock` dependency pin is removed only when it matches this project's exactly.

## Troubleshooting

- **`skills_sh_search` says "authentication_required"** — expected without a token; the result still contains CLI-fallback results, or set `VERCEL_OIDC_TOKEN` (see above). Audits and installs never need the token.
- **Install tool reports "No skills found"** — that message comes from the skills CLI when its fast fetch path fails and the git-clone fallback runs in a restricted network. Retry, or check git access to `github.com`; the tool surfaces the full CLI output.
- **Dependency install fails at OpenCode startup** — run it manually once: `cd .opencode && npm install` (the single dependency resolves from npm identically; `package.json` is exact-pinned so there is no drift).
- **Commands/agent don't appear** — confirm the files landed under the scope you actually started OpenCode in (project `.opencode/` vs `~/.config/opencode/`), and restart: assets are discovered at session start. Also check OpenCode is 1.18 or newer (`opencode --version`): this extension uses the current plural directory names (`plugins/`, `tools/`, `commands/`, `agents/`, `skills/`).
