import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserFromSession } from "./lib/session";
import { Id } from "./_generated/dataModel";

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, sessionToken }) => {
    const items = await ctx.db
      .query("feedback")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .collect();

    // Get current user for vote state
    let currentUserId: Id<"users"> | null = null;
    if (sessionToken) {
      const user = await getUserFromSession(ctx, sessionToken);
      currentUserId = user?._id ?? null;
    }

    return await Promise.all(
      items.map(async (f) => {
        const votes = await ctx.db
          .query("feedbackVotes")
          .withIndex("by_feedback", (q) => q.eq("feedbackId", f._id))
          .collect();

        const userVoted = currentUserId
          ? votes.some((v) => v.userId === currentUserId)
          : false;

        return { ...f, voteCount: votes.length, userVoted };
      })
    );
  },
});

export const add = mutation({
  args: {
    sessionToken: v.string(),
    projectId: v.id("projects"),
    whatWorks: v.optional(v.string()),
    whatDoesnt: v.optional(v.string()),
    featureRequest: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromSession(ctx, args.sessionToken);
    if (!user) throw new Error("Not authenticated");

    // One feedback per user per project
    const existing = (
      await ctx.db
        .query("feedback")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect()
    ).find((f) => f.userId === user._id);

    if (existing) {
      return await ctx.db.patch(existing._id, {
        whatWorks: args.whatWorks,
        whatDoesnt: args.whatDoesnt,
        featureRequest: args.featureRequest,
      });
    }

    return await ctx.db.insert("feedback", {
      projectId: args.projectId,
      userId: user._id,
      githubUsername: user.githubUsername,
      githubAvatarUrl: user.githubAvatarUrl,
      whatWorks: args.whatWorks,
      whatDoesnt: args.whatDoesnt,
      featureRequest: args.featureRequest,
    });
  },
});

export const toggleVote = mutation({
  args: {
    sessionToken: v.string(),
    feedbackId: v.id("feedback"),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromSession(ctx, args.sessionToken);
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("feedbackVotes")
      .withIndex("by_feedback_and_user", (q) =>
        q.eq("feedbackId", args.feedbackId).eq("userId", user._id)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert("feedbackVotes", {
        feedbackId: args.feedbackId,
        userId: user._id,
      });
    }
  },
});
