import { tool } from "@opencode-ai/plugin";
import { authHelpText, fetchRawSkillMd, normalizeSkillId, skillsShApi } from "../lib/skills-sh";

type DetailResponse = {
  id?: string;
  slug?: string;
  installs?: number;
  hash?: string | null;
  files?: { path: string; contents: string }[] | null;
};

const SKILL_MD_PREVIEW_CHARS = 4000;

export default tool({
  description:
    "Fetch full detail for one skill from the skills.sh directory: install count, upstream content hash (SHA-256), file tree and SKILL.md contents. Use it to inspect a candidate skill or to check whether an installed skill's upstream version changed.",
  args: {
    skill: tool.schema
      .string()
      .describe('Skill id as owner/repo/skill-name (e.g. "vercel-labs/skills/find-skills") or a skills.sh page URL.'),
    include_files: tool.schema
      .boolean()
      .optional()
      .describe("Include file contents (default true; SKILL.md previewed, other files listed only)."),
  },
  async execute(args) {
    let id: string;
    try {
      id = normalizeSkillId(args.skill);
    } catch (err) {
      return `Error: ${String(err)}`;
    }

    const res = await skillsShApi<DetailResponse>(`/api/v1/skills/${id}`);
    if (res.ok && res.data) {
      const d = res.data;
      const lines = [
        `id: ${d.id ?? id}`,
        `installs: ${d.installs ?? "?"}`,
        `upstream hash (SHA-256): ${d.hash ?? "null (no snapshot)"}`,
        "",
      ];
      if (d.files && d.files.length > 0) {
        lines.push(`files (${d.files.length}):`);
        for (const f of d.files) {
          if (f.path.endsWith("SKILL.md") && args.include_files !== false) {
            lines.push(
              `--- ${f.path} ---`,
              f.contents.length > SKILL_MD_PREVIEW_CHARS
                ? f.contents.slice(0, SKILL_MD_PREVIEW_CHARS) + `\n… [truncated ${f.contents.length} chars total]`
                : f.contents,
            );
          } else {
            lines.push(`  ${f.path} (${f.contents.length} chars)`);
          }
        }
      } else {
        lines.push("files: null (no snapshot available via API)");
      }
      return lines.join("\n");
    }
    if (res.authRequired) {
      // No-token fallback: pull SKILL.md straight from the source GitHub repo.
      const [ownerRepo, slug] = [id.split("/").slice(0, 2).join("/"), id.split("/")[2]];
      if (ownerRepo && slug) {
        const md = await fetchRawSkillMd(ownerRepo, slug);
        if (md) {
          const preview =
            md.length > SKILL_MD_PREVIEW_CHARS ? md.slice(0, SKILL_MD_PREVIEW_CHARS) + "\n… [truncated]" : md;
          return [
            `skills.sh API unavailable without a token — SKILL.md fetched from raw.githubusercontent.com instead.`,
            authHelpText(),
            "",
            preview,
          ].join("\n");
        }
      }
      return `skills.sh detail requires a token and the raw GitHub fallback found nothing for ${id}.\n${authHelpText()}`;
    }
    if (res.status === 404) return `Skill not found on skills.sh: ${id}`;
    return `skills.sh detail failed for ${id}: ${res.error}`;
  },
});
