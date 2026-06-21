import { useTheme } from "../../providers/theme";
import type { ClientMessagePart } from "../../hooks/useChat";
import { MODE } from "@kodo/database/enums";
import { TextAttributes } from "@opentui/core";

type Props = {
  parts: ClientMessagePart[];
  model: string;
  mode: MODE;
  duration?: string;
  streaming?: boolean;
  interrupted?: boolean;
};

export function BotMessage({
  parts,
  model,
  mode,
  duration,
  streaming = false,
  interrupted = false,
}: Props) {
  const { colors } = useTheme();
  const text = parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
  return (
    <box width={"100%"} alignItems="center">
      <box paddingY={1} width={"100%"}>
        <box paddingX={1} width={"100%"}>
          <text>{text}</text>
        </box>
      </box>

      <box paddingX={1} paddingBottom={1} width={"100%"} gap={1}>
        <box flexDirection="row" gap={2}>
          <text
            attributes={interrupted ? TextAttributes.DIM : 0}
            fg={
              interrupted
                ? undefined
                : mode == MODE.PLAN
                  ? colors.planMode
                  : colors.primary
            }
          >
            ◉
          </text>
        </box>
        <box flexDirection="row" gap={1}>
          <text attributes={interrupted ? TextAttributes.DIM : 0}>
            {mode === MODE.PLAN ? "Plan" : "Build"}
          </text>
          <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
            ›
          </text>
          <text attributes={TextAttributes.DIM}>{model}</text>
          {(duration || interrupted) && (
            <>
              <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
                ›
              </text>
              <text attributes={TextAttributes.DIM}>
                {interrupted ? "interrupted" : duration}
              </text>
            </>
          )}
        </box>
      </box>
    </box>
  );
}
