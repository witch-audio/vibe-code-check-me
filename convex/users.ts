import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserFromSession } from "./lib/session";

export const getMe = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    if (!sessionToken) return null;
    return getUserFromSession(ctx, sessionToken);
  },
});

/**
 * Called from the GitHub OAuth HTTP action.
 * Creates or updates the user record, generates a 30-day session token.
 */
export const upsertUserAndSession = internalMutation({
  args: {
    githubId: v.number(),
    githubUsername: v.string(),
    githubAvatarUrl: v.string(),
  },
  handler: async (ctx, args) => {
    let user = await ctx.db
      .query("users")
      .withIndex("by_github_id", (q) => q.eq("githubId", args.githubId))
      .unique();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        githubId: args.githubId,
        githubUsername: args.githubUsername,
        githubAvatarUrl: args.githubAvatarUrl,
      });
      user = await ctx.db.get(userId);
    } else {
      await ctx.db.patch(user._id, {
        githubUsername: args.githubUsername,
        githubAvatarUrl: args.githubAvatarUrl,
      });
    }

    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await ctx.db.insert("sessions", {
      userId: user!._id,
      token,
      expiresAt,
    });

    return { sessionToken: token };
  },
});
