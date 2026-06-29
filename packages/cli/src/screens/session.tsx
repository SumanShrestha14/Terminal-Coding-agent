import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, useNavigate } from "react-router";
import { z } from "zod";
import type { InferResponseType } from "hono/client";
import { SessionShell } from "../components/session-shell";
import { BotMessage, UserMessage, ErrorMessage } from "../components/messages";
import { useToast } from "../providers/toast";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";
import prettyMs from "pretty-ms";
import { type SupportedChatModelId, messagePartsSchema } from "@kodo/shared";
import { useChat } from "../hooks/useChat";
import type { Message, ClientMessagePart } from "../hooks/useChat";
import { useKeyboard } from "@opentui/react";
import { MessageStatus } from "@kodo/database/enums";
import { useKeyboardLayer } from "../providers/keyboard-layer";
import { usePromptConfig } from "../providers/prompt-config";

type SessionData = InferResponseType<
  (typeof apiClient.sessions)[":id"]["$get"],
  200
>;

function mapDBMessage(dbMessage: SessionData["messages"]): Message[] {
  return dbMessage.map((msg) => {
    if (msg.role === "ERROR") {
      return { id: msg.id, role: "error", content: msg.content };
    }
    if (msg.role === "USER") {
      return {
        id: msg.id,
        role: "user",
        content: msg.content,
        mode: msg.mode,
        model: msg.model as SupportedChatModelId,
      };
    }

    const parsedParts =
      msg.parts == null ? null : messagePartsSchema.safeParse(msg.parts);
    const parts : ClientMessagePart[] = parsedParts?.success
      ? parsedParts.data.map((part) => {
          part.type === "tool-call"
            ? { ...part, status: "done" as const }
            : part;
        })
      : [];
    return {
      id: msg.id,
      role: "assistant",
      content: msg.content,
      mode: msg.mode,
      model: msg.model as SupportedChatModelId,
      parts,
      ...(msg.duration !== null
        ? { duration: prettyMs(msg.duration * 1000) }
        : {}),
      interrupted: msg.status === MessageStatus.INTERRUPTED,
    };
  });
}

const sessionLocationSchema = z.object({
  session: z.custom<SessionData>(
    (value) => value != null && typeof value === "object" && "id" in value,
  ),
});

function ChatMessage({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return <UserMessage message={msg.content} mode={msg.mode} />;
  }
  if (msg.role === "error") {
    return <ErrorMessage message={msg.content} />;
  }
  return (
    <BotMessage
      parts={msg.parts}
      model={msg.model}
      mode={msg.mode}
      duration={msg.duration}
      streaming={false}
      interrupted={msg.interrupted}
    />
  );
}

function SessionChat({ session }: { session: SessionData }) {
  const [initialMessages] = useState(() => mapDBMessage(session.messages));
  const {mode , model } = usePromptConfig();
  const { isTopLayer } = useKeyboardLayer();
  const { messages, submit, abort, streamingState, interrupt } = useChat(
    session.id,
    initialMessages,
  );
  // stop and pending reply when the user leaves the session screen

  useEffect(() => {
    return () => abort();
  }, [abort]);

  useKeyboard((key) => {
    if (
      key.name === "escape" &&
      isTopLayer("base") &&
      streamingState.status === "streaming"
    ) {
      key.preventDefault();
      interrupt();
    }
  });

  return (
    <SessionShell
      onSubmit={(text) => {
        submit({ userText: text, mode, model });
      }}
      loading={streamingState.status === "streaming"}
      interruptible={streamingState.status === "streaming"}
    >
      {messages.map((msg) => (
        <ChatMessage key={msg.id} msg={msg} />
      ))}

      {streamingState.status === "streaming" &&
        streamingState.parts.length > 0 && (
          <BotMessage
            parts={streamingState.parts}
            model={streamingState.model}
            mode={streamingState.mode}
            streaming
          />
        )}
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
    return (
      <SessionShell onSubmit={() => {}} inputDisabled loading>
        {""}
      </SessionShell>
    );
  }
  return <SessionChat session={session} key={session.id} />;
}
