import { resolve, relative } from "path";
import { readdir, stat } from "fs/promises";
import { tool } from "ai";
import { z } from "zod";

const IGNORED_DIRS = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".turbo",
  ".cache",
];

const MAX_ENTRIES = 200;

export function createListDirectoryTool(cwd: string) {
  return tool({
    description:
      "List the contents of a directory in the project. Returns file and directory names with their types. Skips ignored directories like node_modules, .git, etc.",
    inputSchema: z.object({
      path: z
        .string()
        .describe("Relative path to the directory to list (defaults to project root)")
        .default("."),
      recursive: z
        .boolean()
        .describe("Whether to list contents recursively")
        .default(false),
    }),
    execute: async ({ path, recursive }) => {
      const absolutePath = resolve(cwd, path);

      if (!absolutePath.startsWith(cwd)) {
        return {
          error:
            "Invalid path. The directory must be within the current working directory.",
        };
      }

      try {
        const stats = await stat(absolutePath);

        if (!stats.isDirectory()) {
          return {
            error: `Path is not a directory: ${path}`,
          };
        }

        const entries: { path: string; type: "file" | "directory" }[] = [];
        let truncated = false;

        async function walk(dir: string) {
          if (truncated) return;

          const items = await readdir(dir, { withFileTypes: true });

          for (const item of items) {
            if (truncated) break;

            if (IGNORED_DIRS.includes(item.name)) continue;

            const fullPath = resolve(dir, item.name);
            const relPath = relative(cwd, fullPath);
            const isDir = item.isDirectory();

            if (entries.length >= MAX_ENTRIES) {
              truncated = true;
              break;
            }

            entries.push({
              path: relPath,
              type: isDir ? "directory" : "file",
            });

            if (recursive && isDir) {
              await walk(fullPath);
            }
          }
        }

        await walk(absolutePath);

        return {
          entries,
          ...(truncated ? { truncated: true, totalEntries: entries.length } : {}),
        };
      } catch (err) {
        const isNotFound =
          err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT";
        return {
          error: isNotFound
            ? `Directory not found: ${path}`
            : `Failed to list directory: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  });
}