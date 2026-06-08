import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { useTheme } from "../providers/theme";
export function NewSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { colors } = useTheme();

  const state = location.state as { message?: string } | null;

  useEffect(() => {
    if (!state?.message) {
      navigate("/", { replace: true });
    }
  }, [navigate, state]);

  if (!state?.message) return null;

  return (
    <box
      flexGrow={1}
      padding={2}
      gap={2}
      flexDirection="column"
    >
      <text>Creating soon....</text>
      <text>{`Received message: ${state.message}`}</text>
    </box>
  );
}
