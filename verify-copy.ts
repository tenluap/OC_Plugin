/**
 * Verifies the distribution copy step: replicate exactly what install.sh does
 * (copy the whitelisted .opencode items into a target project), then confirm
 * the copied tools load and the layout is complete. Run: bun run verify-copy
 */
import { $ } from "bun";
import { readdir } from "node:fs/promises";

const tmp = (await new Response((await $`mktemp -d`.quiet()).stdout).text()).trim();
const target = `${tmp}/proj/.opencode`;

// Mirror install.sh's copy list — nothing more (keeps node_modules/.DS_Store/.mimosa out).
const ITEMS = ["tools", "skills", "commands", "agents", "plugins", "lib", "package.json", "bun.lock"];
await $`mkdir -p ${target}`;
for (const item of ITEMS) {
  await $`cp -R ${import.meta.dir}/.opencode/${item} ${target}/`;
}

const entries = await readdir(target);
const missing = ITEMS.filter((e) => !entries.includes(e));
const junk = entries.filter((e) => e === "node_modules" || e === ".mimosa" || e === ".DS_Store");
let ok = true;
console.log("copied entries:", entries.join(", "));
if (missing.length) {
  ok = false;
  console.log(`FAIL missing: ${missing.join(",")}`);
}
if (junk.length) {
  ok = false;
  console.log(`FAIL junk copied: ${junk.join(",")}`);
}
if (!missing.length && !junk.length) console.log("ok  exact item set copied, no junk");

// Load every copied tool module from the installed location.
const toolFiles = (await readdir(`${target}/tools`)).filter((f) => f.endsWith(".ts"));
for (const f of toolFiles) {
  try {
    const m = await import(`${target}/tools/${f}`);
    const good = m.default && typeof m.default === "object";
    if (!good) ok = false;
    console.log(`${good ? " ok" : "FAIL"} loads: ${f}`);
  } catch (err) {
    ok = false;
    console.log(`FAIL loads: ${f} — ${err}`);
  }
}

// Count skills/commands/agent assets.
const skills = (await readdir(`${target}/skills`)).filter((f) => !f.startsWith("."));
const commands = (await readdir(`${target}/commands`)).filter((f) => f.endsWith(".md"));
const agents = (await readdir(`${target}/agents`)).filter((f) => f.endsWith(".md"));
console.log(`skills: ${skills.join(", ")}`);
console.log(`commands: ${commands.join(", ")}`);
console.log(`agents: ${agents.join(", ")}`);
if (skills.length < 3 || commands.length < 4 || agents.length < 1) ok = false;

console.log(ok ? "\nINSTALL COPY VERIFIED" : "\nINSTALL COPY FAILED");
process.exit(ok ? 0 : 1);
