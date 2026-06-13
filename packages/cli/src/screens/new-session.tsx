import { useEffect, useMemo, useRef } from "react";
import { z } from "zod";
import { DEFAULT_CHAT_MODEL_ID } from "@kodo/shared";
import { useNavigate, useLocation } from "react-router";
import { useTheme } from "../providers/theme";
import { BotMessage, ErrorMessage, UserMessage } from "../components/messages";
import { SessionShell } from "./../components/session-shell";
import { useToast } from "../providers/toast";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";

const newSessionStateSchema = z.object({
  message: z.string(),
});

export function NewSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { colors } = useTheme();
  const toast = useToast();
  const hasStartedRef = useRef(false);

  const state = useMemo(() => {
    const parsed = newSessionStateSchema.safeParse(location.state);
    return parsed.success ? parsed.data : null;
  }, [location.state]);

  // GUARD : if navigated here directly without stage , go home
  useEffect(() => {
    if (!state) {
      navigate("/", { replace: true });
    }
  }, [navigate, state]);

  // Create a new session on mount - this screen exists to do this okay
  useEffect(() => {
    if (!state || hasStartedRef.current) return;
    hasStartedRef.current = true;
    let ignore = false;
    const createSession = async () => {
      try {
        const res = await apiClient.sessions.$post({
          json: {
            title: state.message.slice(0, 100),
            cwd: process.cwd(),
            initialMessage: {
              role: "USER",
              content: state.message,
              model: DEFAULT_CHAT_MODEL_ID,
              mode: "BUILD",
            },
          },
        });

        if (ignore) {
          return;
        }

        if (!res.ok) {
          throw new Error(await getErrorMessage(res));
        }

        const session = await res.json();
        navigate(`/sessions/${session.id}`, {
          replace: true,
          state: { session },
        });
      } catch (err) {
        if (ignore) return;
        console.error("Failed to create session", err);
        toast.show({
          message:
            err instanceof Error ? err.message : "Failed to create session",
          variant: "error",
        });
        navigate("/", { replace: true });
      }
    };

    createSession();
    return () => {
      ignore = true;
    }
  }, [state, navigate, toast]);

  if (!state) return null;

  return (
    <SessionShell onSubmit={() => {}} inputDisabled loading>
      <UserMessage message={state.message} />
    </SessionShell>
  );
}
