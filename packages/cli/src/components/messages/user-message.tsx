import { MODE } from "@kodo/database/enums";
import { useTheme } from "../../providers/theme";
import { EmptyBorder } from "../border";

type Props = {
  message: string;
  mode : MODE;
};

export function UserMessage({ message, mode }: Props) {
  const { colors } = useTheme();
  return (
    <box width={"100%"} alignItems="center">
      <box
        border={["left"]}
        borderColor={mode === "PLAN" ? colors.planMode : colors.primary}
        width={"100%"}
        customBorderChars={{
          ...EmptyBorder,
          vertical: "┃",
          bottomLeft: "╹",
        }}
      >
        <box
          justifyContent="center"
          paddingX={2}
          paddingY={2}
          backgroundColor={colors.surface}
          width={"100%"}
        >
          <text>{message}</text>
        </box>
      </box>
    </box>
  );
}
