/**
 * App entry point — imports styles, initializes all modules.
 */

import './styles/base.css';
import './styles/terminal.css';
import './styles/components.css';
import './styles/nav.css';
import './community/community.css';

import { initTerminal } from './terminal.js';
import { handleAuthCallback } from './lib/convex.js';
import { initNav } from './community/nav.js';
import { initFeed } from './community/feed.js';
import { initSubmit } from './community/submit.js';
import { initProject } from './community/project.js';

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    el.scrollTop = 0;
  }
  document.body.classList.toggle('community-mode', el?.classList.contains('community-screen'));
  return el;
}

document.addEventListener('DOMContentLoaded', () => {
  // Detect post-auth redirect before anything else
  const justAuthed = handleAuthCallback();

  initTerminal(switchScreen);

  // Community pages
  const feed = initFeed(
    (slug) => { project.show(slug); switchScreen('project'); },
    () => { submit.show(); switchScreen('submit'); },
    () => switchScreen('landing')
  );

  const submit = initSubmit(
    (slug) => { project.show(slug); switchScreen('project'); },
    () => { feed.show(); switchScreen('community'); }
  );

  const project = initProject(
    () => { feed.show(); switchScreen('community'); }
  );

  // Global nav — pass getters so nav can trigger feed.show() and submit.show()
  const nav = initNav(switchScreen, () => feed, () => submit);

  // Landing → community button
  document.getElementById('landing-community-btn').addEventListener('click', () => {
    feed.show();
    switchScreen('community');
    nav.setActiveTab('community');
  });

  // Hero submit CTA
  document.getElementById('hero-submit-btn').addEventListener('click', () => {
    document.getElementById('nav-submit-btn').click();
  });

  // Nav home brand button
  document.getElementById('nav-home-btn').addEventListener('click', () => {
    switchScreen('landing');
    nav.setActiveTab('landing');
  });

  // Post-auth: user just came back from GitHub OAuth — take them to submit
  if (justAuthed === true) {
    nav.subscribeAuth();
    feed.show();
    submit.show();
    switchScreen('submit');
    nav.setActiveTab('community');
  } else {
    // Default: community feed is the home screen
    feed.show();
    switchScreen('community');
    nav.setActiveTab('community');
  }

  // Track screen changes for active tab
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (m.target.classList.contains('active')) {
        nav.setActiveTab(m.target.id);
        if (m.target.id === 'community') feed.show();
      } else {
        // hide cleanup handled inside each module
      }
    });
  });

  document.querySelectorAll('.screen').forEach(el => {
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
  });
});
