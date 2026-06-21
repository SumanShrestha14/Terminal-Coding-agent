import type { MODE } from "@kodo/database/enums";
import type { DialogContextValue } from "../../providers/dialog";
import type { ToastContextValue } from "../../providers/toast";
import type { SupportedChatModelId } from "@kodo/shared";

export type CommandContext = {
    exit : () => void;
    toast : ToastContextValue;
    dialog : DialogContextValue;
    navigate : (path:string)=>void;
    mode : MODE;
    setMode : (mode:MODE) => void;
    setModel : (model:SupportedChatModelId) => void;
}

export type Command = {
    name: string;
    description: string;
    value: string;
    action?: (ctx: CommandContext) => void | Promise<void>;
}