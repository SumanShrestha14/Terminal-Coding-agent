import open from "open";
import { saveAuth } from "./auth";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

type oAuthState = {
  nonce: string;
  port: number;
};

function toBase64Url(str: string | Uint8Array) {
  return Buffer.from(str).toString("base64url");
}

async function createPkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return toBase64Url(new Uint8Array(digest));
}

function encodeState(state: oAuthState) {
  return toBase64Url(JSON.stringify(state));
}

function decodeState(state: string) {
  const [encoded] = state.split(".");
  if (!encoded) throw new Error("Invalid state");
  return JSON.parse(Buffer.from(encoded, "base64url").toString()) as oAuthState;
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export async function performLogin() {
  const clerkFrontendApi = process.env.CLERK_FRONTEND_API;
  const clientId = process.env.CLERK_OAUTH_CLIENT_ID;
  const apiUrl = process.env.API_URL ?? "https://localhost:3000";

  if (!clerkFrontendApi || !clientId) {
    throw new Error(
      "CLERK_FRONTEND_API and CLERK_OAUTH_CLIENT_ID environment variables are required",
    );
  }
  if (!apiUrl) {
    throw new Error("API_URL environment variable is required");
  }
  const nonce = crypto.randomUUID();
  const codeVerifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const codeChallenge = await createPkceChallenge(codeVerifier);

  let settled = false;
  return new Promise<{ token: string }>((resolve, reject) => {
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname !== "/callback") {
          return new Response("Not found ", { status: 404 });
        }
        const error = url.searchParams.get("error");
        if (error) {
          const msg = url.searchParams.get("error_description") ?? error;
          settled = true;
          reject(new Error(msg));
          setTimeout(() => server.stop(), 500);
          return new Response(`Authentication failed: ${msg}`, { status: 400 });
        }
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) {
          settled = true;
          reject(new Error("Missing code or state"));
          setTimeout(() => server.stop(), 500);
          return new Response(`Bad request:`, { status: 400 });
        }
        // verify from state
        try {
          const payload = decodeState(state);
          if (payload.nonce !== nonce) throw new Error("State mismatch");
        } catch (err) {
          settled = true;
          reject(err);
          setTimeout(() => server.stop(), 500);
          return new Response(`Invalid state:`, { status: 400 });
        }
        try {
          //Exchange code for token
          const redirectUrl = `${apiUrl}/auth/callback`;
          const tokenRes = await fetch(`${clerkFrontendApi}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              redirect_uri: redirectUrl,
              client_id: clientId,
              code_verifier: codeVerifier,
            }),
          });

          if (!tokenRes.ok) {
            const details = await tokenRes.text();
            throw new Error(details || "Failed to exchange code for token");
          }
          const tokenData = (await tokenRes.json()) as { access_token: string };
          settled = true;
          saveAuth({ token: tokenData.access_token });
          resolve({ token: tokenData.access_token });
          setTimeout(() => server.stop(), 500);
          return new Response(
            `Authentication successful. You can close this tab`,
            { status: 200 },
          );
        } catch (err) {
          settled = true;
          reject(err);
          const message = getErrorMessage(err);
          setTimeout(() => server.stop(), 500);
          return new Response(`Authentication failed: ${message}`, {
            status: 500,
          });
        }
      },
    });

    // Build state with port and nonce
    const port = server.port;
    if (typeof port !== "number") {
      server.stop();
      reject(new Error("Failed to get server port"));
      return;
    }

    const state = encodeState({ port, nonce });
    const redirectUrl = `${apiUrl}/auth/callback`;

    const authorizeUrl = new URL(`${clerkFrontendApi}/oauth/authorize`);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUrl);
    authorizeUrl.searchParams.set("scope", "openid email profile");
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("prompt", "login");
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    void open(authorizeUrl.toString());
    setTimeout(() => {
      if (!settled) {
        settled = true;
        server.stop();
        reject(new Error("Login timed out"));
      }
    }, LOGIN_TIMEOUT_MS);
  });
}
