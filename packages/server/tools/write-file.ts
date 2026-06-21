import { resolve, relative, dirname } from "path";
import { writeFile, mkdir } from "fs/promises";
import { tool } from "ai";
import { z } from "zod";

export function createWriteFileTool(cwd: string) {
  return tool({
    description:
      "Create or overwrite a file in the project. Creates parent directories if they don't exist.",
    inputSchema: z.object({
      path: z.string().describe("Relative path to the file to write"),
      content: z.string().describe("The full content to write to the file"),
    }),
    execute: async ({ path, content }) => {
        const absolutePath = resolve(cwd, path);
        if (!absolutePath.startsWith(cwd)) {
          return {
            error: "Invalid path. The file must be within the current working directory.",
          };
        }

        try{
            await mkdir(dirname(absolutePath), { recursive: true });
            await writeFile(absolutePath, content, "utf-8");
            return {
                success: true as const,
                path: relative(cwd, absolutePath),
                bytesWritten: Buffer.byteLength(content, "utf-8"),
            }
        }catch (err) {
            return {
                error: "Failed to write file.",
            };
        }
    }
  });
}