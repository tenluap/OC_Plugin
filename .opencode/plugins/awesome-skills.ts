import type { Plugin } from "@opencode-ai/plugin";

/**
 * awesome-skills — plugin entry.
 *
 * The discover/install surface itself lives in the custom tools registered
 * from .opencode/tools/skills_sh_*.ts; this entry only adds glue:
 * session logging when a skills.sh install finishes, so installs are
 * auditable in the OpenCode server log.
 */
export const AwesomeSkills: Plugin = async ({ client }) => {
  return {
    "tool.execute.after": async (input, output) => {
      try {
        if (input?.tool !== "skills_sh_install") return;
        const ok = typeof output?.output === "string" && output.output.startsWith("Install succeeded");
        await client.app.log({
          body: {
            service: "awesome-skills",
            level: ok ? "info" : "error",
            message: `skills.sh install finished: ${(output?.title ?? "").slice(0, 200)}`,
            extra: { sessionID: input.sessionID, callID: input.callID },
          },
        });
      } catch {
        // never let logging break a session
      }
    },
  };
};
