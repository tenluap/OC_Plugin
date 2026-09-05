/**
 * Shared client for the skills.sh catalog (https://skills.sh, Vercel's Agent
 * Skills Directory) used by the awesome-skills custom tools.
 *
 * Security posture for all outbound requests:
 * - HTTPS only, explicit host allowlist (skills.sh, raw.githubusercontent.com)
 * - Host is validated BEFORE any request; localhost, loopback, private,
 *   reserved, and link-local addresses are rejected (both literal IPs in the
 *   URL and any IP the hostname resolves to)
 * - Hard timeout on every request
 */

const ALLOWED_HOSTS = new Set(["skills.sh", "raw.githubusercontent.com"]);
const TIMEOUT_MS = 20_000;

export type SkillsShSkill = {
  id: string;
  slug: string;
  name: string;
  source: string;
  installs: number;
  sourceType?: string;
  installUrl?: string | null;
  url?: string;
  isDuplicate?: boolean;
};

export type ApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  authRequired: boolean;
  data: T | null;
  error?: string;
};

/** RFC1918 / RFC4193 / loopback / link-local / reserved / 0.0.0.0 ranges. */
function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true; // link-local
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
  if (v.startsWith("ff")) return true; // multicast
  if (v.startsWith("::ffff:")) return isPrivateOrReservedIPv4(v.slice(7));
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  // Literal IP in the URL is never allowed for our hosts.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    throw new Error(`blocked: literal IP host not allowed (${hostname})`);
  }
  if (hostname.includes(":")) {
    if (isPrivateOrReservedIPv6(hostname.replace(/^\[|\]$/g, ""))) {
      throw new Error(`blocked: reserved IPv6 host (${hostname})`);
    }
  }
  if (/(^|\.)localhost$/i.test(hostname) || /\.local$/i.test(hostname) || hostname === "0.0.0.0") {
    throw new Error(`blocked: localhost/reserved host (${hostname})`);
  }
  // Resolve and check every address the hostname maps to.
  const { lookup } = await import("node:dns/promises");
  const records = await lookup(hostname, { all: true, verbatim: true }).catch(() => {
    throw new Error(`blocked: DNS lookup failed for ${hostname}`);
  });
  for (const rec of records) {
    const bad = rec.family === 6 ? isPrivateOrReservedIPv6(rec.address) : isPrivateOrReservedIPv4(rec.address);
    if (bad) throw new Error(`blocked: ${hostname} resolves to private/reserved address ${rec.address}`);
  }
}

/** Fetch an allowlisted HTTPS host with SSRF checks and a hard timeout. */
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error(`blocked: only https is allowed (got ${parsed.protocol})`);
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) throw new Error(`blocked: host ${host} is not on the allowlist`);
  await assertPublicHost(host);
  return fetch(parsed.toString(), {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json", ...init?.headers },
  });
}

/** VERCEL_OIDC_TOKEN per skills.sh docs; SKILLS_SH_TOKEN as a local override. */
export function getOidcToken(): string | undefined {
  return process.env.SKILLS_SH_TOKEN || process.env.VERCEL_OIDC_TOKEN || undefined;
}

export async function skillsShApi<T = unknown>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<ApiResult<T>> {
  const url = new URL(`https://skills.sh${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const token = getOidcToken();
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const res = await safeFetch(url.toString(), { headers });
    if (res.status === 401) {
      return { ok: false, status: 401, authRequired: true, data: null, error: "authentication_required" };
    }
    const json = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        authRequired: false,
        data: null,
        error: json?.error || json?.message || `HTTP ${res.status}`,
      };
    }
    return { ok: true, status: res.status, authRequired: false, data: json };
  } catch (err) {
    return { ok: false, status: 0, authRequired: false, data: null, error: String(err) };
  }
}

/** Normalize "https://skills.sh/owner/repo/slug" or "/api/v1/skills/..." to an id. */
export function normalizeSkillId(input: string): string {
  let id = input.trim().replace(/\/+$/, "");
  id = id.replace(/^https?:\/\/skills\.sh\//i, "/");
  id = id.replace(/^\/api\/v1\/skills\//i, "");
  id = id.replace(/^\/+/, "");
  if (/^https?:\/\//i.test(id)) throw new Error(`unsupported URL: ${input}`);
  const segs = id.split("/").filter(Boolean);
  if (segs.length < 2) throw new Error(`expected id as owner/repo/skill-name, got: ${input}`);
  return segs.slice(-3).join("/") === id && segs.length === 3 ? id : segs.join("/");
}

/** Best-effort no-token fetch of a SKILL.md straight from the source repo. */
export async function fetchRawSkillMd(ownerRepo: string, slug: string): Promise<string | null> {
  const candidates = [
    `https://raw.githubusercontent.com/${ownerRepo}/HEAD/skills/${slug}/SKILL.md`,
    `https://raw.githubusercontent.com/${ownerRepo}/HEAD/${slug}/SKILL.md`,
    `https://raw.githubusercontent.com/${ownerRepo}/HEAD/.claude/skills/${slug}/SKILL.md`,
    `https://raw.githubusercontent.com/${ownerRepo}/HEAD/.agents/skills/${slug}/SKILL.md`,
  ];
  for (const url of candidates) {
    try {
      const res = await safeFetch(url, { headers: { accept: "text/plain" } });
      if (res.ok) {
        const text = await res.text();
        if (text && !text.startsWith("404")) return text;
      }
    } catch {
      // try next candidate path
    }
  }
  return null;
}

export function formatSkillLine(s: SkillsShSkill): string {
  const parts = [
    `- ${s.name}`,
    `id: ${s.id}`,
    `installs: ${s.installs}`,
    s.installUrl ? `install: npx skills add ${s.installUrl}` : undefined,
    s.url ? `page: ${s.url}` : undefined,
    s.isDuplicate ? `[flagged duplicate/fork]` : undefined,
  ].filter(Boolean);
  return parts.join(" | ");
}

export function authHelpText(): string {
  return [
    "skills.sh API requires a Vercel OIDC token for this environment.",
    "Set VERCEL_OIDC_TOKEN (or SKILLS_SH_TOKEN) — see https://skills.sh/docs/api#authentication.",
    "Install/search still work without it: this tool falls back to the `skills` CLI (npx skills find).",
  ].join(" ");
}

/** Bun's $ shell yields Buffer, Blob, or string for output depending on version/flags. */
export async function shellOutputToText(v: unknown): Promise<string> {
  if (typeof v === "string") return v;
  if (v == null) return "";
  const anyV = v as { text?: () => Promise<string> };
  if (typeof anyV.text === "function") return anyV.text();
  if (v instanceof Uint8Array) return new TextDecoder().decode(v);
  return String(v);
}
