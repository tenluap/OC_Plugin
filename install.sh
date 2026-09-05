#!/usr/bin/env bash
# Install the awesome-skills extension into an OpenCode project (or globally).
#
# Usage:
#   bash install.sh /path/to/project   # project scope -> <project>/.opencode/**
#   bash install.sh .                  # current directory (convenience)
#   bash install.sh --global           # global scope  -> ~/.config/opencode/**
#   bash install.sh --check            # doctor: verify prerequisites, change nothing
#   bash install.sh --uninstall [/path/to/project | --global]
#
# Re-running an install is safe: directories are merged, files overwritten.
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")" && pwd)/.opencode"
GLOBAL_DIR="${HOME}/.config/opencode"
DIRS="tools skills commands agents plugins lib"
FILES="package.json bun.lock"
ALL_ITEMS="$DIRS $FILES"

die() { echo "Error: $*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

resolve_dest() {
  case "${1:-}" in
    --global) echo "$GLOBAL_DIR" ;;
    "")       die "usage: bash install.sh /path/to/project | --global | --check | --uninstall" ;;
    .)        echo "$(pwd)/.opencode" ;;
    *)        [ -d "$1" ] || die "target directory '$1' does not exist"
              echo "$1/.opencode" ;;
  esac
}

copy_tree() {
  local dest="$1"
  mkdir -p "$dest"
  for item in $ALL_ITEMS; do
    [ -e "${SRC_DIR}/${item}" ] || continue
    if [ -d "${SRC_DIR}/${item}" ]; then
      # "/." form merges into an existing directory instead of nesting inside it
      mkdir -p "${dest}/${item}"
      cp -R "${SRC_DIR}/${item}/." "${dest}/${item}/"
    elif [ "$item" = "package.json" ] && [ -f "${dest}/${item}" ]; then
      # merge dependencies — the target may already declare deps for other plugins
      merge_package_json "${dest}/${item}"
    else
      cp "${SRC_DIR}/${item}" "${dest}/${item}"
    fi
  done
}

# Union of existing target deps with ours (ours wins on the same key, e.g. a
# newer @opencode-ai/plugin pin); everything else in the target file is kept.
merge_package_json() {
  local dest_file="$1"
  if have node; then
    node -e '
      const fs = require("fs");
      const read = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
      const target = read(process.argv[1]) ?? {};
      const ours = read(process.argv[2]);
      if (!ours) process.exit(1);
      target.dependencies = { ...(target.dependencies ?? {}), ...(ours.dependencies ?? {}) };
      fs.writeFileSync(process.argv[1], JSON.stringify(target, null, 2) + "\n");
    ' "$dest_file" "${SRC_DIR}/package.json" \
      && return 0
    echo "  warn  could not merge ${dest_file} — copying source version over it" >&2
  fi
  cp "${SRC_DIR}/package.json" "$dest_file"
}

check_src() {
  local missing=0 item
  for item in $ALL_ITEMS; do
    if [ ! -e "${SRC_DIR}/${item}" ]; then
      echo "  MISSING in source: ${item}"
      missing=1
    fi
  done
  return "$missing"
}

doctor() {
  echo "Source tree: ${SRC_DIR}"
  check_src && echo "  ok  all extension items present" || die "source tree incomplete"
  echo
  echo "Prerequisites:"
  if have opencode; then echo "  ok  opencode $(opencode --version 2>/dev/null || echo '?')"; else echo "  MISSING  opencode — https://opencode.ai/docs"; fi
  if have node && have npx; then echo "  ok  node $(node --version) + npx (skills CLI runtime)"; else echo "  MISSING  node 18+/npx — needed by skills_sh_install (npx skills add)"; fi
  if have git; then echo "  ok  git $(git --version | cut -d' ' -f3)"; else echo "  MISSING  git — needed by the skills CLI to fetch skill repos"; fi
  if have bun; then echo "  ok  bun $(bun --version) (optional; OpenCode bundles its own)"; else echo "  note  bun not on PATH — fine, OpenCode installs .opencode/package.json deps itself at startup"; fi
  echo
  echo "Nothing was changed. Install with: bash install.sh /path/to/project  (or --global)"
}

uninstall() {
  local dest
  dest="$(resolve_dest "${1:-}")"
  [ -d "$dest" ] || die "nothing installed at ${dest}"
  echo "Removing awesome-skills files from ${dest}"
  rm -f "${dest}"/tools/skills_sh_*.ts
  rm -rf "${dest}"/skills/suggest-skills "${dest}"/skills/suggest-agents "${dest}"/skills/suggest-instructions
  rm -f "${dest}"/commands/suggest-skills.md "${dest}"/commands/suggest-agents.md \
        "${dest}"/commands/suggest-instructions.md "${dest}"/commands/scaffold.md
  rm -f "${dest}"/agents/meta-agentic-project-scaffold.md
  rm -f "${dest}"/plugins/awesome-skills.ts
  rm -rf "${dest}"/lib
  # rmdir only succeeds when empty, so content that isn't ours survives
  for d in plugins agents commands skills tools; do rmdir "${dest}/${d}" 2>/dev/null || true; done
  # remove the dependency pin only if it is exactly ours
  if diff -q "${SRC_DIR}/package.json" "${dest}/package.json" >/dev/null 2>&1; then
    rm -f "${dest}/package.json" "${dest}/bun.lock"
    rmdir "$dest" 2>/dev/null || true
  else
    echo "Left ${dest}/package.json in place (differs from this project's pin)."
  fi
  echo "Uninstalled. Restart OpenCode."
}

case "${1:-}" in
  --check)    doctor; exit 0 ;;
  --uninstall) uninstall "${2:-}" ;;
  --global)
    copy_tree "$GLOBAL_DIR"
    echo "Installed awesome-skills (global): ${GLOBAL_DIR}"
    ;;
  "")
    die "usage: bash install.sh /path/to/project | bash install.sh --global | bash install.sh --check | bash install.sh --uninstall"
    ;;
  *)
    dest="$(resolve_dest "$1")"
    copy_tree "$dest"
    echo "Installed awesome-skills (project): ${dest}"
    ;;
esac

echo
echo "Next: restart OpenCode. Optional: export VERCEL_OIDC_TOKEN (or SKILLS_SH_TOKEN)"
echo "to enable the skills.sh REST API; without it, search falls back to the skills CLI."
echo "Verify anytime with: bash install.sh --check"
