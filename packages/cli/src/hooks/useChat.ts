import { useMemo } from "react";
import { useChat as useAiChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type InferUITools,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage
} from "ai";
import { type ModeType, type SupportedChatModelId, type ToolContracts } from "@kodo/shared"
import { apiClient } from "../lib/api-client";
import { getAuth } from "../lib/auth";
import { executeLocalTools } from "../lib/local-tools";

export type ChatMessageMetaData = {
  mode?: ModeType;
  model?: SupportedChatModelId | string;
  durationMs?: number;
}
type ChatTools = {
  [Name in keyof InferUITools<ToolContracts>]: {
    input: InferUITools<ToolContracts>[Name]["input"]
    output: unknown
  }
}

export type Message = UIMessage<ChatMessageMetaData, never, ChatTools>;

export function useChat(sessionId: string, initialMessages:Message[]) {
  const transport = useMemo(() => {
    return new DefaultChatTransport<Message>({
      api: apiClient.chat.$url().toString(),
      headers() {
        const auth = getAuth();
        return auth ? { Authorization: `Bearer ${auth.token}` } : new Headers();
      },
      prepareSendMessagesRequest({ messages }) {
        const message = messages[messages.length - 1];
        if (!message) throw new Error("No message");

        const metaData = messages.findLast((m) => m.metadata?.mode && m.metadata?.model)?.metadata;
        const previousMessage = messages[messages.length - 2];
        const requestMessage =
          message.role === "assistant" && previousMessage?.role === "user"
            ? [previousMessage, message]
            : [message];
        return {
          body: {
            id: sessionId,
            messages: requestMessage,
            mode: metaData?.mode ?? message.metadata?.mode,
            model: metaData?.model ?? message.metadata?.model,
          },
        }
        }
      }
    )
  }, [sessionId])
  const chat = useAiChat<Message>({
    id: sessionId,
    messages:initialMessages,
    transport,
    onToolCall({ toolCall }) {
      const mode = chat.messages.at(-1)?.metadata?.mode ?? "BUILD";
      void executeLocalTools(toolCall.toolName, toolCall.input, mode)
        .then((result) =>
          chat.addToolOutput({
            tool:toolCall.toolName as keyof ChatTools,
            toolCallId: toolCall.toolCallId,
            output: result,
          })
        )
        .catch((error) => {
          chat.addToolOutput({
            tool: toolCall.toolName as keyof ChatTools,
            toolCallId: toolCall.toolCallId,
            state: 'output-error',
            errorText: error instanceof Error ? error.message : String(error),
          })
        })
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })
  return {
    messages: chat.messages,
    status: chat.status,
    error: chat.error,
    submit: (params: {
      userText: string,
      mode: ModeType,
      model: SupportedChatModelId
    }) => {
      return chat.sendMessage({
        text: params.userText,
        metadata: {
          mode: params.mode,
          model: params.model,
        },
      })
    },
    abort: chat.stop,
    interrupt: chat.stop,
  }
}
