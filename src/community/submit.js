/**
 * Submit a project for community Vibe Check.
 */

import { convex, getSession, isLoggedIn, loginWithGitHub } from '../lib/convex.js';
import { api } from '../../convex/_generated/api.js';

const TAG_OPTIONS = [
  { value: 'first_impressions', label: 'First impressions' },
  { value: 'ui_ux', label: 'UI / UX' },
  { value: 'bugs', label: 'Bugs' },
  { value: 'features', label: 'Feature ideas' },
];

function renderAuthPrompt() {
  return `
    <div class="auth-prompt">
      <h3>Sign in to submit</h3>
      <p>Connect your GitHub to submit your project and get feedback from the community.</p>
      <button class="gh-login-btn" id="submit-gh-login">
        <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        Connect with GitHub
      </button>
    </div>
  `;
}

function renderForm() {
  return `
    <h2 class="submit-heading">Submit your project</h2>
    <p class="submit-sub">Share what you're building and get real feedback from the community.</p>
    <form class="submit-form" id="project-form" novalidate>
      <div class="form-group">
        <label class="form-label" for="proj-name">Project name</label>
        <input class="form-input" type="text" id="proj-name" placeholder="My Awesome App" maxlength="80" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="proj-url">URL <span>(live site or repo)</span></label>
        <input class="form-input" type="url" id="proj-url" placeholder="https://..." required />
      </div>
      <div class="form-group">
        <label class="form-label" for="proj-desc">What does it do? <span>(1-2 sentences)</span></label>
        <textarea class="form-textarea" id="proj-desc" placeholder="A quick description..." maxlength="280" required></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">What feedback do you want?</label>
        <div class="checkbox-grid">
          ${TAG_OPTIONS.map(t => `
            <label class="checkbox-item">
              <input type="checkbox" name="feedback-want" value="${t.value}" />
              ${t.label}
            </label>
          `).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="toggle-row">
          <span>Built with vibe coding / AI tools?</span>
          <input type="checkbox" id="proj-vibe" />
        </label>
      </div>
      <div class="form-group" id="tools-group" style="display:none">
        <label class="form-label" for="proj-tools">Tools used <span>(optional)</span></label>
        <input class="form-input" type="text" id="proj-tools" placeholder="Cursor, Claude, v0..." maxlength="100" />
      </div>
      <p class="form-error" id="form-error"></p>
      <button type="submit" class="submit-btn" id="form-submit-btn">Submit for Vibe Check</button>
    </form>
  `;
}

export function initSubmit(onSuccess, onBack) {
  const screen = document.getElementById('submit');
  const backBtn = screen.querySelector('#submit-back');
  const body = screen.querySelector('#submit-body');

  backBtn.addEventListener('click', onBack);

  function render() {
    if (!isLoggedIn()) {
      body.innerHTML = renderAuthPrompt();
      body.querySelector('#submit-gh-login').addEventListener('click', loginWithGitHub);
    } else {
      body.innerHTML = renderForm();
      wireForm();
    }
  }

  function wireForm() {
    const vibeToggle = document.getElementById('proj-vibe');
    const toolsGroup = document.getElementById('tools-group');

    vibeToggle.addEventListener('change', () => {
      toolsGroup.style.display = vibeToggle.checked ? 'flex' : 'none';
    });

    document.getElementById('project-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('form-error');
      const submitBtn = document.getElementById('form-submit-btn');
      errorEl.textContent = '';

      const name = document.getElementById('proj-name').value.trim();
      const url = document.getElementById('proj-url').value.trim();
      const description = document.getElementById('proj-desc').value.trim();
      const feedbackWants = [...document.querySelectorAll('input[name="feedback-want"]:checked')]
        .map(el => el.value);
      const vibeCoded = document.getElementById('proj-vibe').checked;
      const toolsUsed = document.getElementById('proj-tools').value.trim() || undefined;

      if (!name) { errorEl.textContent = 'Project name is required.'; return; }
      if (!url || !url.startsWith('http')) { errorEl.textContent = 'A valid URL is required.'; return; }
      if (!description) { errorEl.textContent = 'Description is required.'; return; }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      try {
        const slug = await convex.mutation(api.projects.create, {
          sessionToken: getSession(),
          name,
          url,
          description,
          feedbackWants,
          vibeCoded,
          toolsUsed,
        });
        onSuccess(slug);
      } catch (err) {
        errorEl.textContent = err.message || 'Something went wrong. Try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit for Vibe Check';
      }
    });
  }

  return {
    show() {
      render();
      screen.scrollTop = 0;
    },
    hide() {},
  };
}
