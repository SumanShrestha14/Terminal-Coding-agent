import type { MODE } from "@kodo/database";
import { createBashTool } from "./bash";
import { createGrepTool } from "./grep";
import { createGlobTool } from "./glob";
import { createReadFileTool } from "./read-file";
import { createWriteFileTool } from "./write-file";
import { createListDirectoryTool } from "./list-directory";
import { createEditFileTool } from "./edit-file";

export function createTools(cwd: string, mode: MODE) {
    const readOnlyTools = {
        readFile : createReadFileTool(cwd),
        listDirectory : createListDirectoryTool(cwd),
        glob : createGlobTool(cwd),
        grep : createGrepTool(cwd),
    };

    if(mode === "PLAN"){
        return readOnlyTools;
    }

    return {
        ...readOnlyTools,
        writeFile : createWriteFileTool(cwd),
        editFile : createEditFileTool(cwd),
        bash : createBashTool(cwd),
    }
}