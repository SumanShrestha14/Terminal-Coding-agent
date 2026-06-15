import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { streamText as aiStreamText } from "ai";
import { db } from "@kodo/database/client";
import { MODE, MessageStatus } from "@kodo/database/enums";
import { type ChatStreamEvent } from "@kodo/shared";
import { isSupportedChatModel, resolveChatModel } from "../lib/models";

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
  const resolvedModel = resolveChatModel(model);
  let fullText = "";
  try {
    const result = aiStreamText({
      model: resolvedModel.model,
      messages: history,
      abortSignal: abortController.signal,
    });
    for await (const chunk of result.fullStream) {
      if (stream.aborted) break;
      if (chunk.type === "text-delta") {
        fullText += chunk.text;
        const event: ChatStreamEvent = { type: "text-delta", text: chunk.text };
        await stream.writeSSE({
          event: "text-delta",
          data: JSON.stringify(event),
        });
      }
      if (chunk.type === "error") {
        throw chunk.error;
      }
    }
    if (stream.aborted || abortController.signal.aborted) return;
    const endTime = Date.now() - startTime;
    const assistantMessage = await db.message.create({
      data: {
        sessionId,
        role: "ASSISTANT",
        status: MessageStatus.COMPLETE,
        model,
        content: fullText,
        mode,
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
    if (abortController.signal.aborted) return;
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

    const lastMesage = session.messages[session.messages.length - 1];
    if (!lastMesage || lastMesage.role !== "USER") {
      return ctx.json(
        { error: "Session has no pending user message to resume" },
        409,
      );
    }

    if (!isSupportedChatModel(lastMesage.model)) {
      return ctx.json({ error: `Unsupported model : ${lastMesage.model}` }, 409);
    }

    const history = buildConversationHistory(session.messages);
    const abortController = new AbortController();
    return streamSSE(ctx, async (stream) => {
      stream.onAbort(() => {
        abortController.abort();
      });

      await streamAIResponse(stream, {
        sessionId,
        model: lastMesage.model,
        mode: lastMesage.mode,
        abortController,
        history,
      });
      
    });
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
