import { tool } from "@opencode-ai/plugin";
import { normalizeSkillId, skillsShApi } from "../lib/skills-sh";

type AuditResponse = {
  audits?: {
    provider?: string;
    slug?: string;
    status?: string; // pass | warn | fail
    summary?: string;
    auditedAt?: string;
    riskLevel?: string; // NONE .. CRITICAL
  }[];
};

export default tool({
  description:
    "Fetch security audit results for a skill from the skills.sh audit partners (Socket, Snyk, Gen Agent Trust Hub, Runlayer, ZeroLeaks). Returns 404-style guidance when the skill has not been audited yet.",
  args: {
    skill: tool.schema
      .string()
      .describe('Skill id as owner/repo/skill-name (e.g. "vercel-labs/skills/find-skills") or a skills.sh page URL.'),
  },
  async execute(args) {
    let id: string;
    try {
      id = normalizeSkillId(args.skill);
    } catch (err) {
      return `Error: ${String(err)}`;
    }

    const res = await skillsShApi<AuditResponse>(`/api/v1/skills/audit/${id}`);
    if (res.ok && res.data) {
      const audits = res.data.audits ?? [];
      if (audits.length === 0) return `No audits recorded yet for ${id}.`;
      const lines = [`security audits for ${id} (${audits.length}):`];
      for (const a of audits) {
        lines.push(
          `- ${a.provider ?? "unknown"}: status=${a.status ?? "?"} risk=${a.riskLevel ?? "?"} audited=${a.auditedAt ?? "?"}`,
        );
        if (a.summary) lines.push(`  summary: ${a.summary}`);
      }
      return lines.join("\n");
    }
    if (res.status === 404) {
      return `No audits for ${id} yet — audits generate automatically a few minutes after a skill's first install.`;
    }
    if (res.authRequired) {
      return `skills.sh audits require an API token (VERCEL_OIDC_TOKEN or SKILLS_SH_TOKEN) — see https://skills.sh/docs/api#authentication.`;
    }
    return `skills.sh audit failed for ${id}: ${res.error}`;
  },
});
