import { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Resolves a session token to the authenticated user.
 * Returns null if token is missing, expired, or invalid.
 */
export async function getUserFromSession(
  ctx: MutationCtx | QueryCtx,
  token: string | undefined
) {
  if (!token) return null;

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (!session || session.expiresAt < Date.now()) return null;

  return await ctx.db.get(session.userId);
}
