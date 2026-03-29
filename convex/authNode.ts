"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const exchangeGithubCode = internalAction({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("GitHub OAuth credentials not configured");
    }

    const params = new URLSearchParams();
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
    params.set("code", code);

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "VibecodeCheck/1.0",
      },
      body: params.toString(),
    });

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      throw new Error(`GitHub token error: ${tokenData.error ?? "unknown"}`);
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "VibecodeCheck/1.0",
      },
    });

    const ghUser = await userRes.json() as { id: number; login: string; avatar_url: string };
    if (!ghUser.id) throw new Error("Invalid GitHub user response");

    const { sessionToken } = await ctx.runMutation(
      internal.users.upsertUserAndSession,
      {
        githubId: ghUser.id,
        githubUsername: ghUser.login,
        githubAvatarUrl: ghUser.avatar_url,
      }
    );

    return sessionToken as string;
  },
});
