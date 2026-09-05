import { tool } from "@opencode-ai/plugin";
import { normalizeSkillId, shellOutputToText } from "../lib/skills-sh";

/** Rewrite a skills.sh page URL into the source form the skills CLI accepts. */
function toCliSource(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/^https?:\/\/skills\.sh\/([^/]+)\/([^/]+)\/([^/#?]+)/i);
  if (m) return `${m[1]}/${m[2]}`; // owner/repo; the -s flag selects the skill
  return trimmed;
}

export default tool({
  description:
    "Install a skill from the skills.sh directory into this project using the official skills CLI (npx skills add), targeting OpenCode. Project installs land in .agents/skills/ (a valid OpenCode skills location); global installs land in ~/.config/opencode/skills/. Only run after the user explicitly approved installing this skill.",
  args: {
    source: tool.schema
      .string()
      .describe(
        'What to install: "owner/repo" GitHub shorthand, a skills.sh page URL, or a full install URL from search results.',
      ),
    skill: tool.schema
      .string()
      .optional()
      .describe("Skill name to select when the repo contains several skills (passed as `-s <name>`)."),
    global: tool.schema
      .boolean()
      .optional()
      .describe("Install to the user-global location instead of this project (default false)."),
  },
  async execute(args, context) {
    let source: string;
    try {
      // Validate the shape early (owner/repo[/slug] or URL); the CLI does the real resolution.
      if (/^https?:\/\/skills\.sh\//i.test(args.source)) {
        normalizeSkillId(args.source);
        source = toCliSource(args.source);
      } else {
        source = toCliSource(args.source);
        if (!/^[\w.-]+\/[\w.-]+$/.test(source) && !/^https?:\/\//i.test(source)) {
          return `Error: unsupported source "${args.source}" — use owner/repo, a skills.sh URL, or a full https URL.`;
        }
      }
    } catch (err) {
      return `Error: ${String(err)}`;
    }

    const parts = ["npx", "-y", "skills", "add", source, "-y", "--agent", "opencode"];
    if (args.skill) parts.push("-s", args.skill);
    if (args.global) parts.push("-g");

    try {
      const { $ } = await import("bun");
      const proc = await $`${parts}`.cwd(context.directory).nothrow().quiet();
      const out = ((await shellOutputToText(proc.stdout)) + (await shellOutputToText(proc.stderr))).trim();
      const ok = proc.exitCode === 0;
      const scope = args.global ? "~/.config/opencode/skills/" : ".agents/skills/";
      return [
        ok ? `Install succeeded (skills CLI, exit 0).` : `Install FAILED (exit ${proc.exitCode}).`,
        `command: ${parts.join(" ")}`,
        `OpenCode skills location: ${scope}`,
        out ? `\n--- skills CLI output ---\n${out}` : "",
        ok
          ? "\nNew skills are discovered at session start — mention to the user that a restart (or new session) may be needed before the skill tool lists them."
          : "\nCheck the output above. Common causes: no git access to the repo, or the skill name does not match (run skills_sh_search first).",
      ]
        .filter(Boolean)
        .join("\n");
    } catch (err) {
      return `Could not run the skills CLI (is npx available?): ${String(err)}`;
    }
  },
});
