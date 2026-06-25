import { tool } from "ai";
import z from "zod";
import {resolve , relative} from "path";
import { readFile, writeFile } from "fs/promises";

export function createEditFileTool(cwd: string) {
  return tool({
    description: "Make a targeted edit to a file by replacing an exact string match. The oldString must appear exactly once in the file (for safety). Use this for surgical edits instead of rewriting entire files.",
    inputSchema: z.object({
      path: z.string().describe("The relative path to the file to edit."),
      oldString: z.string().describe("The exact string to find and replace (must be unique in the file)."),
      newString: z.string().describe("The new string to insert."),
    }),
    execute: async ({ path, oldString, newString }) => {
      const absolutePath = resolve(cwd, path);
      if(!absolutePath.startsWith(cwd)) {
        return {
          error: "Invalid path. The file must be within the current working directory.",
        }
      }

      try{
        const content = await readFile(absolutePath, "utf-8");
        const occurrences = content.split(oldString).length - 1;
        if(occurrences ===0){
          return {
            error: "The specified string was not found in the file.",
          }
        }

        if(occurrences > 1){
          return {
            error: "The specified string appears multiple times in the file. Edit aborted for safety.",
          }
        }

        const updated = content.replace(oldString, newString);
        await writeFile(absolutePath, updated, "utf-8");
        return {
          sucess : true as const,
          path : relative(cwd, absolutePath),
        }
      }catch (err){
        const message = err instanceof Error ? err.message : String(err);
        return {
          error: `Failed to edit file: ${message}`,
        }
      }
    },
  });
}
