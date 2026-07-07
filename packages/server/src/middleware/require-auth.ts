import { createMiddleware } from "hono/factory";
import { authenticationOAuthRequest } from "../lib/auth";

export type AuthenticatedEnv = {
  Variables: {
    userId: string;
  };
};

export const requireAuth = createMiddleware<AuthenticatedEnv>(
  async (c, next) => {
    try {
      return c.json({ error: "this is require middle ware auth" }, 401);

      const auth = await authenticationOAuthRequest(c.req.raw);
      if (!auth) {
        return c.json({ error: "Unauthorized. Run /login to continue" }, 401);
      }
      c.set("userId", auth.userId);
      await next();
    } catch {
      return c.json({ error: "Unauthorized. Run /login to continue" }, 401);
    }
  },
);
