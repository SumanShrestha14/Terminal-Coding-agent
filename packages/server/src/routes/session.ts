import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as Sentry from "@sentry/hono/bun";
import { z } from "zod";
import { db } from "@kodo/database/client";
import { ROLE, MODE, MessageStatus } from "@kodo/database/enums";
import { findSupportedChatModel } from "@kodo/shared";
import type { AuthenticatedEnv } from "../middleware/require-auth";

const createSessionSchema = z.object({
  title: z.string(),
  cwd: z.string(),
  initialMessage: z
    .object({
      role: z.enum(ROLE),
      content: z.string(),
      mode: z.enum(MODE),
      model: z.string().refine((model) => !!findSupportedChatModel(model), {
        message: "Unsupported model",
      }),
    })
    .optional(),
});

const createSessionValidator = zValidator(
  "json",
  createSessionSchema,
  (res, c) => {
    if (!res.success) {
      Sentry.logger.warn("Session creation failed", {
        path: c.req.url,
        issues: res.error.issues.length,
      });
      return c.json(
        {
          error: "Invalid request body",
        },
        400,
      );
    }
  },
);

const app = new Hono<AuthenticatedEnv>()
  .get("/", async (c) => {
    const userId = c.get("userId");
    const sessions = await db.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });

    Sentry.logger.info("Listed sessions", { count: sessions.length });
    return c.json(sessions);
  })
  .get("/:id", async (c) => {
    const { id } = c.req.param();
    const userId = c.get("userId");

    const session = await db.session.findUnique({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      Sentry.logger.warn("Session not found", {
        userId: userId,
        sessionId: id,
      });
      return c.json(
        {
          error: "Session not found",
        },
        404,
      );
    }

    Sentry.logger.info("Loaded Session", {
      sessionId: id,
    });

    return c.json(session);
  })
  .post("/", createSessionValidator, async (c) => {
    const userId = c.get("userId");

    const { initialMessage, ...data } = c.req.valid("json");
    const session = await db.session.create({
      data: {
        ...data,
        userId: userId,
        ...(initialMessage && {
          messages: {
            create: {
              ...initialMessage,
              status: MessageStatus.COMPLETE,
            },
          },
        }),
      },
      include: { messages: true },
    });
    Sentry.logger.info("Created new session", {
      sessionId: session.id,
      title: session.title,
    });
    return c.json(session, 201);
  });

export default app;
