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

  // Use the origin from state if it's in the allowlist, otherwise fall back to APP_URL
  const defaultAppUrl = process.env.APP_URL ?? "https://vibecodecheck.me";
  let appUrl = defaultAppUrl;
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
    // Exchange code for GitHub access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) throw new Error("No access token returned");

    // Fetch GitHub user profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "VibeCOdeCheck",
      },
    });

    const ghUser = await userRes.json() as {
      id: number;
      login: string;
      avatar_url: string;
    };

    if (!ghUser.id) throw new Error("Invalid GitHub user response");

    const { sessionToken } = await ctx.runMutation(
      internal.users.upsertUserAndSession,
      {
        githubId: ghUser.id,
        githubUsername: ghUser.login,
        githubAvatarUrl: ghUser.avatar_url,
      }
    );

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${appUrl}#session=${sessionToken}`,
      },
    });
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}#auth-error` },
    });
  }
});
