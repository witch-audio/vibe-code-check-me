/**
 * Project detail page — shows project info + feedback thread.
 */

import { convex, getSession, clearSession, isLoggedIn, loginWithGitHub } from '../lib/convex.js';

const TAG_OPTIONS = [
  { value: 'first_impressions', label: 'First impressions' },
  { value: 'ui_ux', label: 'UI / UX' },
  { value: 'bugs', label: 'Bugs' },
  { value: 'features', label: 'Feature ideas' },
];
import { api } from '../../convex/_generated/api.js';

const TAG_LABELS = {
  first_impressions: 'First impressions',
  ui_ux: 'UI / UX',
  bugs: 'Bugs',
  features: 'Feature ideas',
};

function timeAgo(ms) {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function renderFeedbackRow(icon, text) {
  if (!text) return '';
  return `
    <div class="feedback-row">
      <span class="feedback-row-icon">${icon}</span>
      <span class="feedback-row-text">${text}</span>
    </div>
  `;
}

function renderFeedbackCard(item, onVote) {
  const card = document.createElement('div');
  card.className = 'feedback-card';
  card.dataset.id = item._id;
  card.innerHTML = `
    <div class="feedback-card-header">
      <div class="feedback-card-user">
        <img class="feedback-card-avatar" src="${item.githubAvatarUrl}" alt="${item.githubUsername}" />
        <span class="feedback-card-username">@${item.githubUsername}</span>
        <span class="project-card-date" style="font-size:12px;color:var(--gray-300)">· ${timeAgo(item._creationTime)}</span>
      </div>
      <button class="feedback-vote-btn ${item.userVoted ? 'voted' : ''}" data-id="${item._id}">
        ▲ ${item.voteCount}
      </button>
    </div>
    ${renderFeedbackRow('✅', item.whatWorks)}
    ${renderFeedbackRow('❌', item.whatDoesnt)}
    ${renderFeedbackRow('💡', item.featureRequest)}
  `;

  card.querySelector('.feedback-vote-btn').addEventListener('click', () => onVote(item._id));
  return card;
}

export function initProject(onBack) {
  const screen = document.getElementById('project');
  const backBtn = screen.querySelector('#project-back');
  const titleEl = screen.querySelector('#project-title');
  const body = screen.querySelector('#project-body');

  backBtn.addEventListener('click', onBack);

  let currentSlug = null;
  let projectUnsub = null;
  let feedbackUnsub = null;
  let currentProjectId = null;

  function subscribeFeedback(projectId) {
    if (feedbackUnsub) feedbackUnsub();

    feedbackUnsub = convex.onUpdate(
      api.feedback.listByProject,
      { projectId, sessionToken: getSession() ?? undefined },
      (items) => {
        renderFeedbackList(items ?? []);
      }
    );
  }

  function renderFeedbackList(items) {
    const listEl = body.querySelector('#feedback-list');
    if (!listEl) return;

    if (items.length === 0) {
      listEl.innerHTML = '<p class="feedback-empty">No feedback yet. Be the first!</p>';
      return;
    }

    // Sort by votes desc
    const sorted = [...items].sort((a, b) => b.voteCount - a.voteCount);
    listEl.innerHTML = '';
    sorted.forEach(item => listEl.appendChild(renderFeedbackCard(item, handleVote)));
  }

  async function handleVote(feedbackId) {
    if (!isLoggedIn()) { loginWithGitHub(); return; }
    try {
      await convex.mutation(api.feedback.toggleVote, {
        sessionToken: getSession(),
        feedbackId,
      });
    } catch (err) {
      console.error('Vote error:', err);
    }
  }

  function renderFeedbackForm(projectId) {
    const formEl = body.querySelector('#feedback-form');
    const openBtn = body.querySelector('#open-feedback-btn');
    const cancelBtn = body.querySelector('#feedback-cancel');
    const submitBtn = body.querySelector('#feedback-submit');

    openBtn.addEventListener('click', () => {
      if (!isLoggedIn()) { loginWithGitHub(); return; }
      formEl.classList.add('open');
      openBtn.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
      formEl.classList.remove('open');
      openBtn.style.display = '';
      clearForm();
    });

    submitBtn.addEventListener('click', async () => {
      const session = getSession();
      if (!session) { loginWithGitHub(); return; }

      const whatWorks = document.getElementById('fb-works').value.trim() || undefined;
      const whatDoesnt = document.getElementById('fb-doesnt').value.trim() || undefined;
      const featureRequest = document.getElementById('fb-feature').value.trim() || undefined;

      if (!whatWorks && !whatDoesnt && !featureRequest) {
        document.getElementById('fb-error').textContent = 'Add at least one piece of feedback.';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      document.getElementById('fb-error').textContent = '';

      try {
        await convex.mutation(api.feedback.add, {
          sessionToken: session,
          projectId,
          whatWorks,
          whatDoesnt,
          featureRequest,
        });
        formEl.classList.remove('open');
        openBtn.style.display = '';
        clearForm();
      } catch (err) {
        if (err.message?.includes('Not authenticated')) {
          clearSession();
          loginWithGitHub();
        } else {
          document.getElementById('fb-error').textContent = err.message || 'Something went wrong.';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit feedback';
      }
    });
  }

  function wireEditForm(project) {
    const editBtn = body.querySelector('#project-edit-btn');
    if (!editBtn) return;

    editBtn.addEventListener('click', () => {
      // Inject edit form below the header
      const header = body.querySelector('.project-detail-header');
      const existing = body.querySelector('.project-edit-form');
      if (existing) { existing.remove(); editBtn.textContent = 'Edit'; return; }

      editBtn.textContent = 'Cancel';

      const form = document.createElement('div');
      form.className = 'project-edit-form';
      form.innerHTML = `
        <h3 class="edit-form-title">Edit project</h3>
        <div class="form-group">
          <label class="form-label">Project name</label>
          <input class="form-input" id="edit-name" value="${project.name}" maxlength="80" />
        </div>
        <div class="form-group">
          <label class="form-label">URL <span>(live site or repo)</span></label>
          <input class="form-input" id="edit-url" value="${project.url}" />
        </div>
        <div class="form-group">
          <label class="form-label">What does it do? <span>(1-2 sentences)</span></label>
          <textarea class="form-textarea" id="edit-desc" maxlength="280">${project.description}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">What feedback do you want?</label>
          <div class="checkbox-grid">
            ${TAG_OPTIONS.map(t => `
              <label class="checkbox-item">
                <input type="checkbox" name="edit-tag" value="${t.value}" ${project.feedbackWants.includes(t.value) ? 'checked' : ''} />
                ${t.label}
              </label>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="toggle-row">
            <span>Built with vibe coding / AI tools?</span>
            <input type="checkbox" id="edit-vibe" ${project.vibeCoded ? 'checked' : ''} />
          </label>
        </div>
        <div class="form-group" id="edit-tools-group" style="display:${project.vibeCoded ? 'flex' : 'none'}">
          <label class="form-label">Tools used <span>(optional)</span></label>
          <input class="form-input" id="edit-tools" value="${project.toolsUsed ?? ''}" maxlength="100" />
        </div>
        <p class="form-error" id="edit-error"></p>
        <div class="edit-form-actions">
          <button class="feedback-submit-btn" id="edit-save-btn">Save changes</button>
          <button class="feedback-cancel-btn" id="edit-cancel-btn">Cancel</button>
        </div>
      `;

      header.after(form);

      form.querySelector('#edit-vibe').addEventListener('change', (e) => {
        form.querySelector('#edit-tools-group').style.display = e.target.checked ? 'flex' : 'none';
      });

      form.querySelector('#edit-cancel-btn').addEventListener('click', () => {
        form.remove();
        editBtn.textContent = 'Edit';
      });

      form.querySelector('#edit-save-btn').addEventListener('click', async () => {
        const session = getSession();
        if (!session) { loginWithGitHub(); return; }

        const name = form.querySelector('#edit-name').value.trim();
        const url = form.querySelector('#edit-url').value.trim();
        const description = form.querySelector('#edit-desc').value.trim();
        const feedbackWants = [...form.querySelectorAll('input[name="edit-tag"]:checked')].map(el => el.value);
        const vibeCoded = form.querySelector('#edit-vibe').checked;
        const toolsUsed = form.querySelector('#edit-tools').value.trim() || undefined;
        const errorEl = form.querySelector('#edit-error');
        const saveBtn = form.querySelector('#edit-save-btn');

        if (!name) { errorEl.textContent = 'Name is required.'; return; }
        if (!url || !url.startsWith('http')) { errorEl.textContent = 'A valid URL is required.'; return; }
        if (!description) { errorEl.textContent = 'Description is required.'; return; }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        errorEl.textContent = '';

        try {
          await convex.mutation(api.projects.update, {
            sessionToken: session,
            projectId: project._id,
            name, url, description, feedbackWants, vibeCoded, toolsUsed,
          });
          form.remove();
          editBtn.textContent = 'Edit';
        } catch (err) {
          errorEl.textContent = err.message || 'Something went wrong.';
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save changes';
        }
      });
    });
  }

  function clearForm() {
    ['fb-works', 'fb-doesnt', 'fb-feature'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const errEl = document.getElementById('fb-error');
    if (errEl) errEl.textContent = '';
  }

  return {
    show(slug) {
      currentSlug = slug;
      screen.scrollTop = 0;
      body.innerHTML = '<p class="feed-loading">Loading...</p>';
      titleEl.textContent = '';

      projectUnsub = convex.onUpdate(
        api.projects.getBySlug,
        { slug, sessionToken: getSession() ?? undefined },
        (project) => {
          if (!project) {
            body.innerHTML = '<p class="feed-empty">Project not found.</p>';
            return;
          }

          titleEl.textContent = project.name;
          currentProjectId = project._id;

          body.innerHTML = `
            <div class="project-detail-header">
              <div class="project-detail-title-row">
                <h1 class="project-detail-name">${project.name}</h1>
                ${project.isOwner ? '<button class="project-edit-btn" id="project-edit-btn">Edit</button>' : ''}
              </div>
              <div class="project-detail-meta">
                <img class="project-detail-avatar" src="${project.githubAvatarUrl}" alt="${project.githubUsername}" />
                <span class="project-detail-username">@${project.githubUsername}</span>
                ${project.vibeCoded ? '<span class="vibe-badge">⚡ Vibe Coded</span>' : ''}
              </div>
              <a class="project-detail-link" href="${project.url}" target="_blank" rel="noopener noreferrer">
                Visit →
              </a>
              <div class="project-detail-preview">
                <img
                  src="https://s0.wordpress.com/mshots/v1/${encodeURIComponent(project.url)}?w=900&h=500"
                  alt="${project.name} screenshot"
                  class="project-detail-screenshot"
                  onerror="this.parentElement.style.display='none'"
                />
              </div>
              <p class="project-detail-desc">${project.description}</p>
              ${project.feedbackWants.length ? `
                <div class="project-detail-tags">
                  <span style="font-size:12px;color:var(--gray-300);margin-right:4px">Wants feedback on:</span>
                  ${project.feedbackWants.map(t => `<span class="project-detail-tag">${TAG_LABELS[t] ?? t}</span>`).join('')}
                </div>
              ` : ''}
              ${project.toolsUsed ? `<p style="font-size:12px;color:var(--gray-300);margin-top:10px">Built with: ${project.toolsUsed}</p>` : ''}
            </div>

            <div class="feedback-section">
              <h2 class="feedback-section-heading">Feedback</h2>

              <button class="add-feedback-btn" id="open-feedback-btn">
                + Give feedback
              </button>

              <div class="feedback-form" id="feedback-form">
                <p class="feedback-form-title">Your feedback</p>
                <div class="form-group">
                  <label class="form-label">✅ What's working <span>(optional)</span></label>
                  <textarea class="form-textarea" id="fb-works" placeholder="The onboarding flow is super smooth..." style="min-height:70px"></textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">❌ What's not working <span>(optional)</span></label>
                  <textarea class="form-textarea" id="fb-doesnt" placeholder="The search breaks on mobile..." style="min-height:70px"></textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">💡 Feature request <span>(optional)</span></label>
                  <textarea class="form-textarea" id="fb-feature" placeholder="Would love dark mode..." style="min-height:70px"></textarea>
                </div>
                <p class="form-error" id="fb-error"></p>
                <div class="feedback-form-actions">
                  <button class="feedback-submit-btn" id="feedback-submit">Submit feedback</button>
                  <button class="feedback-cancel-btn" id="feedback-cancel">Cancel</button>
                </div>
              </div>

              <div class="feedback-list" id="feedback-list">
                <p class="feed-loading">Loading feedback...</p>
              </div>
            </div>
          `;

          if (project.isOwner) {
            wireEditForm(project);
          }
          renderFeedbackForm(project._id);
          subscribeFeedback(project._id);
        }
      );
    },
    hide() {
      if (projectUnsub) { projectUnsub(); projectUnsub = null; }
      if (feedbackUnsub) { feedbackUnsub(); feedbackUnsub = null; }
      currentProjectId = null;
    },
  };
}
