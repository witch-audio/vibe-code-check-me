/**
 * Convex client + session management.
 * Session token is persisted in localStorage; picked up from URL hash after OAuth.
 */

import { ConvexClient } from "convex/browser";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
const SESSION_KEY = "vcc_session";

export const convex = new ConvexClient(CONVEX_URL);

// ─── Session ─────────────────────────────────────────────────────────────────

export function getSession() {
  return localStorage.getItem(SESSION_KEY);
}

export function setSession(token) {
  localStorage.setItem(SESSION_KEY, token);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn() {
  return !!getSession();
}

/**
 * Call once on app init — picks up ?session=TOKEN from hash after GitHub OAuth redirect.
 */
/**
 * Returns true if a fresh session was just received from OAuth redirect.
 * Returns false on auth error. Returns null if no auth in this page load.
 */
export function handleAuthCallback() {
  const hash = window.location.hash;
  if (hash.startsWith("#session=")) {
    const token = hash.slice(9);
    setSession(token);
    history.replaceState(null, "", window.location.pathname);
    return true;
  }
  if (hash.startsWith("#auth-error")) {
    const msg = hash.includes("=") ? decodeURIComponent(hash.split("=")[1]) : "unknown";
    history.replaceState(null, "", window.location.pathname);
    console.error("GitHub auth failed:", msg);
    return false;
  }
  return null;
}

// ─── GitHub OAuth ─────────────────────────────────────────────────────────────

export function loginWithGitHub() {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  const callbackUrl = import.meta.env.VITE_CONVEX_SITE_URL + "/auth/github/callback";
  // Pass current origin as state so the callback can redirect back here (works for localhost dev too)
  const state = encodeURIComponent(window.location.origin);
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=read:user&state=${state}`;
  window.location.href = url;
}
