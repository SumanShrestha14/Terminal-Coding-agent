import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { db } from "@kodo/database";
import { ROLE, MODE, MessageStatus } from "@kodo/database/enums";
import { findSupportedChatModel } from "@kodo/shared";

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
      return c.json(
        {
          error: "Invalid request body",
        },
        400,
      );
    }
  },
);

const app = new Hono()
  .get("/", async (c) => {
    const sessions = await db.session.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });
    return c.json(sessions);
  })
  .get("/:id", async (c) => {
    // MOCK : Uncomment to simulate slow session loading
    // await new Promise((resolve) => setTimeout(resolve, 5000));

    // MOCK : Uncomment to simulate session loading failure
    // throw new HTTPException(500, {
    //   message: "MOCK Error : Failed to load session",
    // });

    const { id } = c.req.param();
    const session = await db.session.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return c.json(
        {
          error: "Session not found",
        },
        404,
      );
    }

    return c.json(session);
  })
  .post("/", createSessionValidator, async (c) => {
    // MOCK : Uncomment to simulate slow session loading
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    // MOCK : Uncomment to simulate session loading failure
    // throw new HTTPException(500, {
    //   message: "MOCK Error : Failed to load session",
    // });

    const { initialMessage, ...data } = c.req.valid("json");
    const session = await db.session.create({
      data: {
        ...data,
        userId: "mock-user-id",
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
    return c.json(session, 201);
  });

export default app;