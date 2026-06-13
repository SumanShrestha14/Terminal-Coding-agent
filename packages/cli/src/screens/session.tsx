import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, useNavigate } from "react-router";
import { z } from "zod";
import type { InferResponseType } from "hono/client";

import { SessionShell } from "../components/session-shell";
import { BotMessage, UserMessage, ErrorMessage } from "../components/messages";
import { useToast } from "../providers/toast";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";

type SessionData = InferResponseType<
  (typeof apiClient.sessions)[":id"]["$get"],
  200
>;

const sessionLocationSchema = z.object({
  session: z.custom<SessionData>(
    (value) => value != null && typeof value === "object" && "id" in value,
  ),
});

function ChatMessage({ msg }: { msg: SessionData["messages"][number] }) {
  if (msg.role === "USER") {
    return <UserMessage message={msg.content} />;
  }
  if (msg.role === "BOT") {
    return <BotMessage content={msg.content} model={msg.model} />;
  }
  if (msg.role === "ERROR") {
    return <ErrorMessage message={msg.content} />;
  }
}

export function Session() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const preFetched = useMemo(() => {
    const parsed = sessionLocationSchema.safeParse(location.state);
    return parsed.success ? parsed.data.session : null;
  }, [location.state]);

  const [session, setSession] = useState<SessionData | null>(preFetched);

  useEffect(() => {
    //skip if we already have the session data from location state (prefetched)
    if (session) return;
    setSession(null); // reset session while loading new data
    if (!id) {
      return;
    }

    let ignore = false;
    const fetchSession = async () => {
      try {
        const res = await apiClient.sessions[":id"].$get({ param: { id } });
        if (ignore) return;
        if (!res.ok) throw new Error(await getErrorMessage(res));
        const session = await res.json();
        setSession(session);
      } catch (err) {
        if (ignore) return;
        toast.show({
          variant: "error",
          message:
            err instanceof Error ? err.message : "Failed to load session",
        });

        navigate("/", { replace: true });
      }
    };
    fetchSession();

    return () => {
      ignore = true;
    };
  }, [id, navigate, toast, preFetched]);

  if (!session) {
    return <SessionShell onSubmit={() => {}} inputDisabled loading />;
  }
  return (
    <SessionShell onSubmit={() => {}} inputDisabled>
      {/* {session.messages.map((msg, index) => chatMessage({ msg }))} */}

      {session.messages.map((msg) => {
        return <ChatMessage key={msg.id} msg={msg} />;
      })}
    </SessionShell>
  );
}
