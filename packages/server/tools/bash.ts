import { tool } from "ai";
import z from "zod";

const MAX_OUTPUT = 20_000;
const DEFAULT_TIMEOUT = 30_000;

export function createBashTool(cwd: string) {
  return tool({
    description:
      "Execute a bash command in the specified directory.Use this for running tests,builds,git operations,installing packages,or any other command-line tasks.",
    inputSchema: z.object({
      command: z.string().describe("The bash command to execute."),
      timeout: z
        .number()
        .default(DEFAULT_TIMEOUT)
        .describe("The timeout for the command in milliseconds."),
    }),
    execute: async ({ command, timeout }) => {
      try {
        const proc = Bun.spawn(["bash", "-c", command], {
          cwd,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...process.env,
            TERM: "dumb",
          },
        });

        const timer = setTimeout(() => {
          proc.kill();
        }, timeout);

        const [stdout, stderr] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ]);
        const exitCode = await proc.exited;
        clearTimeout(timer);

        const truncate = (str: string) =>
          str.length > MAX_OUTPUT
            ? str.slice(0, MAX_OUTPUT) + "\n...[output truncated]"
            : str;

        return {
          stdout: truncate(stdout),
          stderr: truncate(stderr),
          exitCode,
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return {
          error: `Command execution failed: ${message}`,
        };
      }
    },
  });
}
