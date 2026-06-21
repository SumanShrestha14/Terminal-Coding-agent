import { TextAttributes } from "@opentui/core";
import { useTheme } from "../providers/theme";
import { usePromptConfig } from "../providers/prompt-config";
import { MODE } from "@kodo/database/enums";

export function StatusBar() {
  const {mode,model} = usePromptConfig();
  const { colors } = useTheme();

  return (
    <box flexDirection="row" gap={1}>
      {/* <text fg={colors.primary}>Build</text> */}
      <text fg={mode === MODE.PLAN ? colors.planMode : colors.primary}>
        {mode === MODE.PLAN ? "Plan" : "Build"}
      </text>
      <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
        &#8250;
      </text>
      <text>{model}</text>
    </box>
  );
}
