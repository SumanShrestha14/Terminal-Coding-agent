import { Hono } from "hono";

function getLocalCallbackUrl(state: string) {
  const [encoded] = state.split(".");
  if (!encoded) {
    throw new Error("Invalid state");
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as {
    port?: unknown;
  };
  const port = payload.port;
  if (
    typeof port !== "number" ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error("Invalid port");
  }

  return new URL(`http://localhost:${port}/callback`);
}
const auth = new Hono().get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  const errorDescription = c.req.query("error_description");
  if (error) {
    if (!state) {
      return c.text(errorDescription ?? error, 400);
    }
    try {
      const redirectUrl = getLocalCallbackUrl(state);
      redirectUrl.searchParams.set("error", error);
      if (errorDescription) {
        redirectUrl.searchParams.set("error_description", errorDescription);
      }
      redirectUrl.searchParams.set("state", state);
      return c.redirect(redirectUrl.toString());
    } catch {
      return c.text(errorDescription ?? error, 400);
    }
  }

  if (!code || !state) {
    return c.text("Missing authorization code or state", 400);
  }

  try {
    const redirectUrl = getLocalCallbackUrl(state);
    redirectUrl.searchParams.set("code", code);
    redirectUrl.searchParams.set("state", state);
    return c.redirect(redirectUrl.toString());
  } catch (e) {
    return c.text("Invalid authentication state", 400);
  }
});

export default auth;
