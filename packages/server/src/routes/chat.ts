import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { streamText as aiStreamText } from "ai";
import { db } from "@kodo/database/client";
import { MODE, MessageStatus } from "@kodo/database/enums";
import {
  type ChatStreamEvent,
  type MessagePart,
  toolCallArgsSchema,
  messagePartsSchema,
} from "@kodo/shared";
import { isSupportedChatModel, resolveChatModel } from "../lib/models";
import type { Prisma } from "@kodo/database";

const submitSchma = z.object({
  content: z.string(),
  mode: z.enum(MODE),
  model: z.string().refine(isSupportedChatModel, "Unsupported model"),
});

const submitValidator = zValidator("json", submitSchma, (res, ctx) => {
  if (!res.success) {
    return ctx.json({ error: "Invalid request body" }, 400);
  }
});

const activeResumeSessionIds = new Set<string>();

function buildConversationHistory(
  messages: {
    role: "USER" | "ASSISTANT" | "ERROR";
    content: string;
    status: MessageStatus;
  }[],
) {
  return messages.flatMap((message) => {
    if (message.role === "ERROR") return [];
    if (message.role === "ASSISTANT" && message.content.length === 0) return [];
    return [
      {
        role:
          message.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: message.content,
      },
    ];
  });
}

function getResumableUserMessage(
  messages: {
    role: "USER" | "ASSISTANT" | "ERROR";
    model: string;
    mode: MODE;
  }[],
) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "USER") return null;

  return lastMessage;
}

type streamParams = {
  sessionId: string;
  model: string;
  mode: MODE;
  abortController: AbortController;
  history: { role: "user" | "assistant"; content: string }[];
};

async function streamAIResponse(
  stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
  params: streamParams,
) {
  const { sessionId, model, mode, abortController, history } = params;
  const startTime = Date.now();
  const parts: MessagePart[] = [];

  const resolvedModel = resolveChatModel(model);
  // let fullText = "";

  const persistInteruptedMessage = async () => {
    // if (fullText.length === 0) return;
    const fullText = parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
    if (fullText.length === 0 && parts.length === 0) return;

    const duration = Date.now() - startTime;
    const validatedParts: Prisma.InputJsonValue | undefined =
      parts.length > 0 ? messagePartsSchema.parse(parts) : undefined;
    await db.message.create({
      data: {
        sessionId,
        role: "ASSISTANT",
        status: MessageStatus.INTERRUPTED,
        model,
        content: fullText,
        parts: validatedParts,
        mode,
        duration: Math.round(duration / 1000),
      },
    });
  };
  try {
    const result = aiStreamText({
      model: resolvedModel.model,
      messages: history,
      abortSignal: abortController.signal,
      providerOptions: resolvedModel.providerOptions,
    });
    for await (const chunk of result.fullStream) {
      if (stream.aborted) break;
      if (chunk.type === "reasoning-delta") {
        const last = parts[parts.length - 1];
        if (last && last.type === "reasoning") {
          last.text += chunk.text;
        } else {
          parts.push({ type: "reasoning", text: chunk.text });
        }
        const event: ChatStreamEvent = {
          type: "reasoning-delta",
          text: chunk.text,
        };
        await stream.writeSSE({
          event: "reasoning-delta",
          data: JSON.stringify(event),
        });
      }
      if (chunk.type === "text-delta") {
        const last = parts[parts.length - 1];
        if (last && last.type === "text") {
          last.text += chunk.text;
        } else {
          parts.push({ type: "text", text: chunk.text });
        }
        const event: ChatStreamEvent = { type: "text-delta", text: chunk.text };
        await stream.writeSSE({
          event: "text-delta",
          data: JSON.stringify(event),
        });
      }

      if (chunk.type === "tool-call") {
        const args = toolCallArgsSchema.parse(chunk.input);
        parts.push({
          type: "tool-call",
          id: chunk.toolCallId,
          name: chunk.toolName,
          args,
        });
        const event: ChatStreamEvent = {
          type: "tool-call",
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          args,
        };
        await stream.writeSSE({
          event: "tool-call",
          data: JSON.stringify(event),
        });
      }

      if (chunk.type === "tool-result") {
        const resStr =
          typeof chunk.output === "string"
            ? chunk.output
            : JSON.stringify(chunk.output);
        const toolCallPart = parts.find(
          (p): p is Extract<MessagePart, { type: "tool-call" }> =>
            p.type === "tool-call" && p.id === chunk.toolCallId,
        );

        if(toolCallPart) {
          toolCallPart.result = resStr;
        }

        const event: ChatStreamEvent = {
          type: "tool-result",
          toolCallId: chunk.toolCallId,
          result: resStr,
        }

        await stream.writeSSE({
          event: "tool-result",
          data: JSON.stringify(event),
        })
      }
      if (chunk.type === "error") {
        throw chunk.error;
      }
    }
    if (stream.aborted || abortController.signal.aborted) {
      await persistInteruptedMessage();
      return;
    }
    const endTime = Date.now() - startTime;

    const fullText = parts.filter((p) => p.type === "text").map((p) => p.text).join("");

    const validatedParts: Prisma.InputJsonValue | undefined =
      parts.length > 0 ? messagePartsSchema.parse(parts) : undefined;
    const assistantMessage = await db.message.create({
      data: {
        sessionId,
        role: "ASSISTANT",
        status: MessageStatus.COMPLETE,
        model,
        content: fullText,
        mode,
        parts: validatedParts,
        duration: Math.round(endTime / 1000),
      },
    });

    const doneEvent: ChatStreamEvent = {
      type: "done",
      messageId: assistantMessage.id,
      durationMs: endTime,
    };

    await stream.writeSSE({ event: "done", data: JSON.stringify(doneEvent) });
  } catch (err) {
    if (abortController.signal.aborted) {
      await persistInteruptedMessage();
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    await db.message.create({
      data: {
        sessionId,
        role: "ERROR",
        status: MessageStatus.COMPLETE,
        model,
        content: message,
        mode,
      },
    });
    const errorEvent: ChatStreamEvent = { type: "error", message };
    await stream.writeSSE({ event: "error", data: JSON.stringify(errorEvent) });
  }
}

const chat = new Hono()
  .post("/:sessionId/resume", async (ctx) => {
    const { sessionId } = ctx.req.param();
    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!session) {
      return ctx.json({ error: "Session not found" }, 404);
    }

    const resumableMessage = getResumableUserMessage(session.messages);
    if (!resumableMessage) {
      return ctx.json(
        { error: "Session has no pending user message to resume" },
        409,
      );
    }

    if (!isSupportedChatModel(resumableMessage.model)) {
      return ctx.json(
        { error: `Unsupported model : ${resumableMessage.model}` },
        409,
      );
    }

    if (activeResumeSessionIds.has(sessionId)) {
      return ctx.json(
        { error: "Session already has an active resume connection" },
        409,
      );
    }

    activeResumeSessionIds.add(sessionId);

    const history = buildConversationHistory(session.messages);
    const abortController = new AbortController();
    try {
      return streamSSE(ctx, async (stream) => {
        stream.onAbort(() => {
          abortController.abort();
        });
        try {
          await streamAIResponse(stream, {
            sessionId,
            model: resumableMessage.model,
            mode: resumableMessage.mode,
            abortController,
            history,
          });
        } finally {
          activeResumeSessionIds.delete(sessionId);
        }
      });
    } catch (err) {
      activeResumeSessionIds.delete(sessionId);
      throw err;
    }
  })
  .post("/:sessionId", submitValidator, async (ctx) => {
    const { sessionId } = ctx.req.param();
    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!session) {
      return ctx.json({ error: "Session not found" }, 404);
    }

    const data = ctx.req.valid("json");
    await db.message.create({
      data: {
        sessionId,
        role: "USER",
        status: MessageStatus.COMPLETE,
        model: data.model,
        content: data.content,
        mode: data.mode,
      },
    });

    const history = buildConversationHistory([
      ...session.messages,
      {
        role: "USER" as const,
        content: data.content,
        status: MessageStatus.COMPLETE,
      },
    ]);

    const abortController = new AbortController();

    return streamSSE(ctx, async (stream) => {
      stream.onAbort(() => {
        abortController.abort();
      });

      await streamAIResponse(stream, {
        sessionId,
        model: data.model,
        mode: data.mode,
        abortController,
        history,
      });
    });
  });

export default chat;
