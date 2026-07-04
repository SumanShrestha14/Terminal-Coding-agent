import { useState, useEffect, useMemo,useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router";
import { z } from "zod";
import type { InferResponseType } from "hono/client";
import { SessionShell } from "../components/session-shell";
import { BotMessage, UserMessage, ErrorMessage } from "../components/messages";
import { useToast } from "../providers/toast";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";
import { type SupportedChatModelId , type ModeType} from "@kodo/shared";
import { useChat } from "../hooks/useChat";
import type { Message } from "../hooks/useChat";
import { useKeyboard } from "@opentui/react";
import { useKeyboardLayer } from "../providers/keyboard-layer";
import { usePromptConfig } from "../providers/prompt-config";

type SessionData = InferResponseType<
  (typeof apiClient.sessions)[":id"]["$get"],
  200
  >;

const sessionLocationSchema = z.object({
    session: z.custom<SessionData>(
    (value) => value != null && typeof value === "object" && "id" in value,
  ),
  initialPrompt: z.object({
    message: z.string(),
    mode: z.custom<ModeType>(),
    model: z.custom<SupportedChatModelId>(),
  }).optional()
});

function ChatMessage({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    const text = msg.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
    return <UserMessage message={text } mode={msg.metadata?.mode ?? "BUILD"} />;
  }

  return (
    <BotMessage
      parts={msg.parts}
      model={msg.metadata?.model ?? "unknown"}
      mode={msg.metadata?.mode ?? "BUILD"}
      durationMs={msg.metadata?.durationMs}
      streaming={false}
    />
  );
}

function SessionChat({
    session,
    initialPrompt
  }:
    {
    session: SessionData;
    initialPrompt?: { message: string; mode: ModeType; model: SupportedChatModelId } | undefined
  }) {
  const [initialMessages] = useState(() => session.messages as unknown as Message[]);
  const {mode , model } = usePromptConfig();
  const { isTopLayer } = useKeyboardLayer();
  const { messages, submit, abort, status, interrupt, error } = useChat(
    session.id,
    initialMessages,
  );

  const hasSubmittedInitialPromptRef = useRef(false);
  // stop and pending reply when the user leaves the session screen

  useEffect(() => {
    return () => { void abort() };
  }, [abort]);

  useKeyboard((key) => {
    if (
      key.name === "escape" &&
      isTopLayer("base") &&
      status === "streaming"
    ) {
      key.preventDefault();
      interrupt();
    }
  });

  useEffect(() => {
    if (!initialPrompt && hasSubmittedInitialPromptRef.current) return;

    hasSubmittedInitialPromptRef.current = true;
    void submit({
      userText: initialPrompt.message,
      mode: initialPrompt.mode,
      model: initialPrompt.model,
    });
  }, [initialPrompt, submit]);

  return (
    <SessionShell
      onSubmit={(text) => {
        submit({ userText: text, mode, model });
      }}
      loading={status === "streaming" || status === "submitted"}
      interruptible={status === "streaming" || status === "submitted"}
    >
      {messages.map((msg) => (
        <ChatMessage key={msg.id} msg={msg} />
      ))}
      {error && <ErrorMessage message={error.message} />}
    </SessionShell>
  );
}

export function Session() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const preFetched = useMemo(() => {
    const parsed = sessionLocationSchema.safeParse(location.state);
    return parsed.success ? parsed.data : null;
  }, [location.state]);

  const [session, setSession] = useState<SessionData | null>(preFetched?.session ?? null);

  useEffect(() => {
    //skip if we already have the session data from location state (prefetched)
    if (preFetched?.session) return;
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
    return (
      <SessionShell onSubmit={() => {}} inputDisabled loading>
        {""}
      </SessionShell>
    );
  }
  return <SessionChat
    session={session}
    key={session.id}
    initialPrompt={preFetched?.initialPrompt}
  />;
}
