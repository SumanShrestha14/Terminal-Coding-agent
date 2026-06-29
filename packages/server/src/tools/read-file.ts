import { resolve, relative } from "path";
import { readFile, stat } from "fs/promises";
import { tool } from "ai";
import { z } from "zod";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function createReadFileTool(cwd: string) {
  return tool({
    description:
      "Read the contents of a file in the project. Returns an error if the file is too large or cannot be read.",
    inputSchema: z.object({
      path: z.string().describe("Relative path to the file to read"),
    }),
    execute: async ({ path }) => {
      const absolutePath = resolve(cwd, path);

      if (!absolutePath.startsWith(cwd)) {
        return {
          error:
            "Invalid path. The file must be within the current working directory.",
        };
      }

      try {
        const stats = await stat(absolutePath);

        if (stats.size > MAX_FILE_SIZE) {
          return {
            error: `File too large (${stats.size} bytes). Maximum allowed size is ${MAX_FILE_SIZE} bytes.`,
          };
        }

        const content = await readFile(absolutePath, "utf-8");

        return { content };
      } catch (err) {
        const isNotFound =
          err instanceof Error && "code" in err && err.code === "ENOENT";
        return {
          error: isNotFound
            ? `File not found: ${relative(cwd, absolutePath)}`
            : `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  });
}
