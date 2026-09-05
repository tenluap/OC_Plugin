import { tool } from "@opencode-ai/plugin";
import {
  authHelpText,
  formatSkillLine,
  shellOutputToText,
  skillsShApi,
  type SkillsShSkill,
} from "../lib/skills-sh";

type SearchResponse = {
  data?: SkillsShSkill[];
  count?: number;
  searchType?: string;
};
type ListResponse = {
  data?: SkillsShSkill[];
  pagination?: { page: number; perPage: number; total: number; hasMore: boolean };
};

export default tool({
  description:
    "Search the skills.sh Agent Skills Directory (skills.sh) for agent skills by keyword, or list the leaderboard (view=all-time|trending|hot) / official curated skills (view=curated). Returns id, installs and install command for each match.",
  args: {
    query: tool.schema
      .string()
      .optional()
      .describe("Search text (min 2 chars). Omit when using view to list leaderboard/curated."),
    view: tool.schema
      .enum(["all-time", "trending", "hot", "curated"])
      .optional()
      .describe("List mode instead of search: all-time/trending/hot leaderboard, or curated official skills."),
    limit: tool.schema.number().optional().describe("Max results, 1-200 (default 20)."),
    owner: tool.schema.string().optional().describe("Restrict to one GitHub owner, e.g. vercel-labs."),
  },
  async execute(args) {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 200);

    if (args.query && args.query.trim().length < 2) {
      return "Error: query must be at least 2 characters.";
    }

    if (args.view === "curated" || (args.view && !args.query)) {
      const path = args.view === "curated" ? "/api/v1/skills/curated" : "/api/v1/skills";
      const res = await skillsShApi(path, {
        view: args.view === "curated" ? undefined : args.view,
        per_page: limit,
        page: 0,
      });
      if (res.ok && res.data) {
        if (args.view === "curated") {
          const d = res.data as {
            totalOwners?: number;
            totalSkills?: number;
            generatedAt?: string;
          } & Record<string, unknown>;
          const groups = Object.entries(d).filter(([, v]) => Array.isArray(v)) as [string, SkillsShSkill[]][];
          const lines: string[] = [`skills.sh curated (official) skills — ${d.totalSkills ?? "?"} total:`];
          for (const [owner, skills] of groups) {
            lines.push(`\n## ${owner}`);
            for (const s of skills.slice(0, 5)) lines.push(formatSkillLine(s));
          }
          return lines.join("\n");
        }
        const d = res.data as ListResponse;
        const items = d.data ?? [];
        return [
          `skills.sh leaderboard (view=${args.view}, ${d.pagination?.total ?? items.length} total):`,
          ...items.map(formatSkillLine),
        ].join("\n");
      }
      if (res.authRequired) {
        return `skills.sh list failed: no API token.\n${authHelpText()}`;
      }
      return `skills.sh list failed: ${res.error}`;
    }

    // Search path (query given, or nothing at all -> default search needs query)
    const query = args.query ?? "";
    if (!query) {
      return "Error: provide either `query` (search text) or `view` (list mode).";
    }
    const res = await skillsShApi<SearchResponse>("/api/v1/skills/search", {
      q: query,
      limit,
      owner: args.owner,
    });
    if (res.ok && res.data?.data) {
      const items = res.data.data.filter((s) => !s.isDuplicate);
      const dupes = res.data.data.length - items.length;
      return [
        `skills.sh search "${query}" (${res.data.searchType ?? "?"}, ${items.length} results` +
          (dupes ? `, ${dupes} duplicates hidden` : "") + "):",
        ...items.map(formatSkillLine),
      ].join("\n");
    }
    if (res.authRequired) {
      // No-token fallback: the public `skills` CLI searches without an OIDC token.
      try {
        const { $ } = await import("bun");
        const proc = await $`npx -y skills find ${query}`.nothrow().quiet();
        const out = ((await shellOutputToText(proc.stdout)) + (await shellOutputToText(proc.stderr))).trim();
        if (out) {
          return [
            `skills.sh API unavailable without a token — results below come from the skills CLI.`,
            authHelpText(),
            "",
            out,
          ].join("\n");
        }
      } catch {
        // CLI missing/unavailable — fall through to guidance
      }
      return `skills.sh search requires a token and the skills CLI fallback produced nothing.\n${authHelpText()}`;
    }
    return `skills.sh search failed: ${res.error}`;
  },
});
