import Header from "../components/header";
import { InputBar } from "../components/input-bar";
import { useTheme } from "../providers/theme";

type Props = {
  children: React.ReactNode;
};

export function ThemeRoot({ children }: Props) {
  const { colors } = useTheme();
  return (
    <box width="100%" height="100%" backgroundColor={colors.background}>
      {children}
    </box>
  );
}
