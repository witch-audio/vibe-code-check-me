import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    githubId: v.number(),
    githubUsername: v.string(),
    githubAvatarUrl: v.string(),
  }).index("by_github_id", ["githubId"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  projects: defineTable({
    userId: v.id("users"),
    githubUsername: v.string(),
    githubAvatarUrl: v.string(),
    name: v.string(),
    url: v.string(),
    description: v.string(),
    feedbackWants: v.array(v.string()),
    vibeCoded: v.boolean(),
    toolsUsed: v.optional(v.string()),
    slug: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_user", ["userId"]),

  feedback: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    githubUsername: v.string(),
    githubAvatarUrl: v.string(),
    whatWorks: v.optional(v.string()),
    whatDoesnt: v.optional(v.string()),
    featureRequest: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  feedbackVotes: defineTable({
    feedbackId: v.id("feedback"),
    userId: v.id("users"),
  })
    .index("by_feedback", ["feedbackId"])
    .index("by_feedback_and_user", ["feedbackId", "userId"]),
});
