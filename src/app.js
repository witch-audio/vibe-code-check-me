/**
 * App entry point — imports styles, initializes all modules.
 */

import './styles/base.css';
import './styles/terminal.css';
import './styles/components.css';
import './styles/vibe-check.css';

import { initTerminal } from './terminal.js';
import { initVibeCheck } from './vibe-check/vibe-check.js';

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    el.scrollTop = 0;
  }
  return el;
}

function switchScreenInstant(id) {
  // Suppress transitions for the initial render to prevent flicker
  const screens = document.querySelectorAll('.screen');
  screens.forEach(s => { s.style.transition = 'none'; s.classList.remove('active'); });
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    el.scrollTop = 0;
  }
  // Re-enable transitions after the next two frames (ensures paint has settled)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    screens.forEach(s => { s.style.transition = ''; });
  }));
  return el;
}

document.addEventListener('DOMContentLoaded', () => {
  initTerminal(switchScreen);
  initVibeCheck();

  // Default: Vibe Check is the landing tab
  switchScreenInstant('vibe-check');
});
