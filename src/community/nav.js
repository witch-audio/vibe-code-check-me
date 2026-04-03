/**
 * Global navigation bar — auth state, routing, active tab.
 */

import { convex, getSession, clearSession, loginWithGitHub } from '../lib/convex.js';
import { api } from '../../convex/_generated/api.js';

const SECTIONS = {
  'vibe-check': ['vibe-check'],
  home: ['landing', 'loading-screen', 'stories'],
  community: ['community'],
  submit: ['submit'],
  project: ['project'],
};

export function initNav(switchScreen, getCommunityFeed, getSubmitModule, getVibeCheck) {
  const userArea = document.getElementById('nav-user-area');
  const vibeCheckTab = document.getElementById('nav-tab-vibe-check');
  const communityTab = document.getElementById('nav-tab-community');
  const wrappedTab = document.getElementById('nav-tab-home');

  // Tab clicks
  vibeCheckTab.addEventListener('click', () => {
    getVibeCheck().show();
    switchScreen('vibe-check');
  });

  communityTab.addEventListener('click', () => {
    getCommunityFeed().show();
    switchScreen('community');
  });

  document.getElementById('nav-submit-btn').addEventListener('click', () => {
    if (!getSession()) {
      loginWithGitHub();
      return;
    }
    getSubmitModule().show();
    switchScreen('submit');
  });

  // Subscribe to auth state — updates nav whenever session resolves
  let unsubscribe = null;

  function subscribeAuth() {
    if (unsubscribe) unsubscribe();
    const token = getSession();

    unsubscribe = convex.onUpdate(
      api.users.getMe,
      { sessionToken: token ?? undefined },
      (user) => renderUserArea(user)
    );
  }

  function renderUserArea(user) {
    if (user) {
      userArea.innerHTML = `
        <div class="nav-user">
          <img class="nav-avatar" src="${user.githubAvatarUrl}" alt="${user.githubUsername}" />
          <span class="nav-username">@${user.githubUsername}</span>
          <button class="nav-signout" id="nav-signout-btn" title="Sign out">✕</button>
        </div>
      `;
      document.getElementById('nav-signout-btn').addEventListener('click', () => {
        clearSession();
        subscribeAuth();
      });
    } else {
      clearSession();
      userArea.innerHTML = `
        <button class="nav-signin-btn" id="nav-signin-btn">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          Sign in
        </button>
      `;
      document.getElementById('nav-signin-btn').addEventListener('click', loginWithGitHub);
    }
  }

  function setActiveTab(screenId) {
    [vibeCheckTab, wrappedTab, communityTab].filter(Boolean).forEach((tab) => {
      tab.classList.remove('active');
    });
    if (SECTIONS['vibe-check'].includes(screenId)) {
      vibeCheckTab.classList.add('active');
    }
    if (['community', 'submit', 'project'].includes(screenId)) {
      communityTab.classList.add('active');
    }
  }

  subscribeAuth();

  return { setActiveTab, subscribeAuth };
}
