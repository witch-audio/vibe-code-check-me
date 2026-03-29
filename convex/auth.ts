import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const ALLOWED_ORIGINS = [
  "https://vibecodecheck.me",
  "http://localhost:5173",
  "http://localhost:4173",
];

export const githubCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  // Use the origin from state if it's in the allowlist, otherwise fall back to default
  let appUrl = "https://vibecodecheck.me";
  if (stateParam) {
    const candidateOrigin = decodeURIComponent(stateParam);
    if (ALLOWED_ORIGINS.includes(candidateOrigin)) {
      appUrl = candidateOrigin;
    }
  }

  if (!code) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}#auth-error` },
    });
  }

  try {
    // Delegate to Node.js action where process.env is available
    const sessionToken = await ctx.runAction(internal.authNode.exchangeGithubCode, { code });

    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}#session=${sessionToken}` },
    });
  } catch (err) {
    const msg = err instanceof Error ? encodeURIComponent(err.message) : "unknown";
    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}#auth-error=${msg}` },
    });
  }
});
