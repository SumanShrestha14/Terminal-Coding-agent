import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { useTheme } from "../providers/theme";
import { BotMessage, ErrorMessage, UserMessage } from "../components/messages";
import { SessionShell } from './../components/session-shell';

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
    <SessionShell onSubmit={() => {}} inputDisabled loading>
      <ErrorMessage message ="This is a dummy error message " />
      <UserMessage message = {state.message} />
      <BotMessage content="this is a sample of how bot will reply." model="opus 4.5"/>
    </SessionShell>
  );
}
