import { Hono } from "hono";
import { sentry } from "@sentry/hono/bun";
import * as Sentry from "@sentry/hono/bun";
import { HTTPException } from "hono/http-exception";
import sessions from "./routes/session";
import chat from "./routes/chat";
import auth from "./routes/auth";
import { requireAuth } from "./middleware/require-auth";

const app = new Hono();

app.use(
  sentry(app, {
    dsn: "https://e9612c056e9db7e0731dee0ef1a438f7@o4511558990102528.ingest.de.sentry.io/4511558993182800",
    tracesSampleRate: 1.0,
    enableLogs: true,
    sendDefaultPii: true,
  }),
);

app.get("/debug-sentry", () => {
  // Send a log before throwing the error
  Sentry.logger.info("User triggered test error", {
    action: "test_error_endpoint",
  });
  // Send a test metric before throwing the error
  Sentry.metrics.count("test_counter", 1);
  throw new Error("My first Sentry error!");
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    Sentry.logger.warn("Handled HTTP exception", {
      status: err.status,
      message: err.message || "Request failed",
      path: c.req.url,
      method: c.req.method,
    });
    return c.json(
      {
        error: err.message || "Request failed",
      },
      err.status,
    );
  }
  Sentry.logger.error("Unhandled error", {
    path: c.req.url,
    method: c.req.method,
    message: err instanceof Error ? err.message : "Unknown error",
  });
  return c.json({ error: "Internal Server error!" }, 500);
});

app.use("/chat/*", requireAuth);
app.use("/sessions/*", requireAuth);

const routes = app
  .route("/sessions", sessions)
  .route("/chat", chat)
  .route("/auth", auth);
export type AppType = typeof routes;
export default { port: 3000, fetch: app.fetch, idleTimeout: 255 };
