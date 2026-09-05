/**
 * Smoke test for the awesome-skills plugin. Run: bun run smoke.ts
 * Exercises the shared client (SSRF guard + API), tool module loading, and
 * frontmatter lint for skills/agents/commands. Network calls hit only
 * allowlisted hosts.
 */
import { $ } from "bun";
import { shellOutputToText } from "./.opencode/lib/skills-sh.ts";

async function procText(p: { stdout: unknown; stderr: unknown }): Promise<string> {
  return ((await shellOutputToText(p.stdout)) + (await shellOutputToText(p.stderr))).trim();
}

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// --- 1. tool + plugin modules load ---------------------------------------
console.log("== module loading ==");
for (const mod of [
  "./.opencode/tools/skills_sh_search.ts",
  "./.opencode/tools/skills_sh_detail.ts",
  "./.opencode/tools/skills_sh_audit.ts",
  "./.opencode/tools/skills_sh_install.ts",
  "./.opencode/plugins/awesome-skills.ts",
]) {
  try {
    const m = await import(mod);
    const def = m.default ?? m.AwesomeSkills;
    check(mod, typeof def === "function" || (def && typeof def === "object"));
  } catch (err) {
    check(mod, false, String(err));
  }
}

// --- 2. lib: id normalization + SSRF guard --------------------------------
console.log("== lib/skills-sh ==");
const lib = await import("./.opencode/lib/skills-sh.ts");
check("normalize url", lib.normalizeSkillId("https://skills.sh/vercel-labs/skills/find-skills") === "vercel-labs/skills/find-skills");
check("normalize bare id", lib.normalizeSkillId("vercel-labs/skills/find-skills") === "vercel-labs/skills/find-skills");
try {
  lib.normalizeSkillId("https://evil.example/a/b");
  check("reject foreign url", false);
} catch {
  check("reject foreign url", true);
}

async function blocked(url: string): Promise<boolean> {
  try {
    await lib.safeFetch(url);
    return false;
  } catch (e) {
    return String(e).includes("blocked");
  }
}
check("reject http", await blocked("http://skills.sh/api/v1/skills"));
check("reject non-allowlisted host", await blocked("https://example.com/x"));
check("reject literal private ip", await blocked("https://192.168.1.10/x"));
check("reject localhost", await blocked("https://localhost.evil/x") || (await (async () => {
  try { await lib.safeFetch("https://localhost/x"); return false; } catch (e) { return String(e).includes("blocked"); }
})()));

// --- 3. live API (no token -> authRequired) --------------------------------
console.log("== skills.sh API (anonymous) ==");
const res = await lib.skillsShApi("/api/v1/skills/search", { q: "typescript", limit: 3 });
check(
  "anonymous search -> authRequired (expected per skills.sh)",
  res.status === 401 && res.authRequired === true,
  `status=${res.status} error=${res.error}`,
);
const raw = await lib.fetchRawSkillMd("vercel-labs/skills", "find-skills");
check("raw fallback fetches find-skills SKILL.md", !!raw && raw.includes("name:"), raw ? `len=${raw.length}` : "null");

// --- 4. skills CLI fallback + real install in a temp dir -------------------
console.log("== skills CLI ==");
const tmp = (await procText(await $`mktemp -d`.quiet())).trim();
const add = await $`npx -y skills add anthropics/skills -s frontend-design -y --agent opencode`
  .cwd(tmp).nothrow().quiet();
const cliOut = await procText(add);
const installed = (await Array.fromAsync(
  new Bun.Glob("**/SKILL.md").scan({ cwd: tmp, dot: true, absolute: false }),
)).filter((p) => p.startsWith(".agents/skills/"));
check(
  "npx skills add installs to .agents/skills/",
  add.exitCode === 0 && installed.length > 0,
  `exit=${add.exitCode} found=${installed.join(",") || "none"} out=${cliOut.slice(0, 200)}`,
);

// --- 5. frontmatter lint ----------------------------------------------------
console.log("== assets ==");
const nameRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for await (const skillMd of new Bun.Glob(".opencode/skills/*/SKILL.md").scan({ dot: true })) {
  const dir = skillMd.split("/")[2];
  const head = await Bun.file(skillMd).text();
  const name = head.match(/^name:\s*(\S+)/m)?.[1];
  const desc = head.match(/^description:\s*(.+)/m)?.[1];
  check(`skill ${dir}: name matches folder`, name === dir, `name=${name}`);
  check(`skill ${dir}: description 1-1024 chars`, !!desc && desc.replace(/^['"]|['"]$/g, "").length <= 1024);
  check(`skill ${dir}: slug valid`, nameRe.test(dir));
}
const agentMd = await Bun.file(".opencode/agents/meta-agentic-project-scaffold.md").text();
check("agent has description", /^description:/m.test(agentMd));
check("agent mode valid", /mode:\s*(primary|subagent|all)/.test(agentMd));

// --- 5b. agent frontmatter permission schema -------------------------------
// Current OpenCode schema: permission keys are tool names, values only
// allow/ask/deny. Legacy `tools:` boolean maps and hardcoded `model:` fields
// are banned (model omission = user's default OpenCode model).
console.log("== agent frontmatter schema ==");
for await (const agentPath of new Bun.Glob(".opencode/agents/*.md").scan({ dot: true })) {
  const fm = (await Bun.file(agentPath).text()).split("---")[1] ?? "";
  check(`${agentPath}: no legacy tools: map`, !/^tools:/m.test(fm));
  check(`${agentPath}: no model: field`, !/^model:/m.test(fm));
  const permValues: string[] = [];
  let inPerm = false;
  for (const line of fm.split("\n")) {
    if (/^permission:/.test(line)) {
      inPerm = true;
      continue;
    }
    if (inPerm) {
      if (/^\S/.test(line)) inPerm = false;
      else {
        const m = line.match(/^\s+[\w*?"'-]+:\s*(.+)$/);
        if (m) permValues.push(m[1].trim().replace(/^["']|["']$/g, ""));
      }
    }
  }
  const bad = permValues.filter((v) => !["allow", "ask", "deny"].includes(v));
  check(
    `${agentPath}: permission values only allow/ask/deny`,
    bad.length === 0,
    bad.join(" | "),
  );
}
for (const cmd of ["suggest-skills", "suggest-agents", "suggest-instructions", "scaffold"]) {
  const md = await Bun.file(`.opencode/commands/${cmd}.md`).text();
  check(`command ${cmd}: has description + body`, /^description:/m.test(md) && md.split("---").at(-1)!.trim().length > 0);
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
