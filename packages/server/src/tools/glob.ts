import { tool } from "ai";
import z from "zod";
import { resolve, relative } from "path";

const MAX_OUTPUT = 200;
const IGNORED_DIRS = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".turbo",
  ".cache",
];
export function createGlobTool(cwd: string) {
  return tool({
    description:
      "Find files matching a glob pattern. Returns file paths relative to the project root. Skips node_modules and hidden directories.",
    inputSchema: z.object({
      pattern: z
        .string()
        .describe(
          "The glob pattern to match (e.g. '**/*.ts', 'src/**/*.tsx') ",
        ),
      path: z
        .string()
        .describe("Relative directory to search in (defaults to project root)")
        .default("."),
      timeout: z
        .number()
        .default(30000)
        .describe("The timeout for the command in milliseconds."),
    }),
    execute: async ({ pattern, path }) => {
      const absolutePath = resolve(cwd, path);
      if (!absolutePath.startsWith(cwd)) {
        return {
          error:
            "Invalid path. The search directory must be within the current working directory.",
        };
      }

      try {
        const glob = new Bun.Glob(pattern);
        const files: string[] = [];
        let truncated = false;

        for await (const match of glob.scan({
          cwd: absolutePath,
          dot: false,
          onlyFiles: true,
        })) {
          if (IGNORED_DIRS.some((dir) => match.split("/").includes(dir))) {
            continue;
          }

          if (files.length >= MAX_OUTPUT) {
            truncated = true;
            break;
          }

          const absoluteMatch = resolve(absolutePath, match);
          files.push(relative(cwd, absoluteMatch));
        }
        files.sort();
        return {
          files,
          ...(truncated
            ? {
                truncated: true,
              }
            : {}),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          error: `Failed to execute glob search: ${message}`,
        };
      }
    },
  });
}
