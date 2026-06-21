import { tool } from "ai";
import z from "zod";
import { resolve, relative } from "path";

const MAX_MATCHES = 50;
const IGNORED_DIRS = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".turbo",
  ".cache",
];

export function createGrepTool(cwd: string) {
  return tool({
    description:
      "Search file contents using a regex pattern. Returns matching lines with file paths and line numbers. Skips hidden directories, node_modules, and binary files.",
    inputSchema: z.object({
      pattern: z.string().describe("Regex pattern to search for"),
      path: z
        .string()
        .describe("Relative directory to search in (defaults to project root)")
        .default("."),
      include: z
        .string()
        .describe("Glob pattern to filter files (e.g. '*.ts', '*.tsx')")
        .optional(),
    }),
    execute: async ({ pattern, path, include }) => {
      const absolutePath = resolve(cwd, path);
      if (!absolutePath.startsWith(cwd)) {
        return {
          error:
            "Invalid path. The search directory must be within the current working directory.",
        };
      }

      try {
        const args = [
          "-rn",
          "--color=never",
          ...IGNORED_DIRS.map((dir) => `--exclude-dir=${dir}`),
          "-E",
        ];

        if (include) {
          args.push(`--include=${include}`);
        }

        args.push(pattern, absolutePath);

        const proc = Bun.spawn(["grep", ...args], {
          stdout: "pipe",
          stderr: "pipe",
          cwd,
        });

        const [stdoutText, stderrText] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ]);

        await proc.exited;

        if (proc.exitCode !== 0 && proc.exitCode !== 1) {
          return {
            error: `Grep command failed with exit code ${proc.exitCode}: ${stderrText}`,
          };
        }

        if (!stdoutText.trim()) {
          return {
            matches: [],
            message: "No matches found.",
          };
        }

        const lines = stdoutText.trim().split("\n");
        const matches: { file: string; line: number; content: string }[] = [];
        let truncated = false;

        for (const line of lines) {
          if (matches.length >= MAX_MATCHES) {
            truncated = true;
            break;
          }

          const [, filePath, lineNum, content] =
            line.match(/^(.*?):(\d+):(.*)$/) ?? [];

          if (filePath && lineNum && content !== undefined) {
            matches.push({
              file: relative(cwd, filePath),
              line: parseInt(lineNum, 10),
              content,
            });
          }
        }

        return {
          matches,
          ...(truncated ? { truncated: true, totalMatches: lines.length } : {}),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          error: `Failed to execute grep search: ${message}`,
        };
      }
    },
  });
}