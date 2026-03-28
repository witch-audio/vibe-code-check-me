import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserFromSession } from "./lib/session";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .order("desc")
      .take(50);

    return await Promise.all(
      projects.map(async (p) => {
        const feedbackCount = (
          await ctx.db
            .query("feedback")
            .withIndex("by_project", (q) => q.eq("projectId", p._id))
            .collect()
        ).length;
        return { ...p, feedbackCount };
      })
    );
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!project) return null;

    const feedbackCount = (
      await ctx.db
        .query("feedback")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()
    ).length;

    return { ...project, feedbackCount };
  },
});

export const create = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
    url: v.string(),
    description: v.string(),
    feedbackWants: v.array(v.string()),
    vibeCoded: v.boolean(),
    toolsUsed: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromSession(ctx, args.sessionToken);
    if (!user) throw new Error("Not authenticated");

    // Generate unique slug
    let slug = toSlug(args.name);
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    await ctx.db.insert("projects", {
      userId: user._id,
      githubUsername: user.githubUsername,
      githubAvatarUrl: user.githubAvatarUrl,
      name: args.name,
      url: args.url,
      description: args.description,
      feedbackWants: args.feedbackWants,
      vibeCoded: args.vibeCoded,
      toolsUsed: args.toolsUsed,
      slug,
    });
    return slug;
  },
});
