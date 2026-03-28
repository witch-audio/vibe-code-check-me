/**
 * Project detail page — shows project info + feedback thread.
 */

import { convex, getSession, isLoggedIn, loginWithGitHub } from '../lib/convex.js';
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
          sessionToken: getSession(),
          projectId,
          whatWorks,
          whatDoesnt,
          featureRequest,
        });
        formEl.classList.remove('open');
        openBtn.style.display = '';
        clearForm();
      } catch (err) {
        document.getElementById('fb-error').textContent = err.message || 'Something went wrong.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit feedback';
      }
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
        { slug },
        (project) => {
          if (!project) {
            body.innerHTML = '<p class="feed-empty">Project not found.</p>';
            return;
          }

          titleEl.textContent = project.name;
          currentProjectId = project._id;

          body.innerHTML = `
            <div class="project-detail-header">
              <h1 class="project-detail-name">${project.name}</h1>
              <div class="project-detail-meta">
                <img class="project-detail-avatar" src="${project.githubAvatarUrl}" alt="${project.githubUsername}" />
                <span class="project-detail-username">@${project.githubUsername}</span>
                ${project.vibeCoded ? '<span class="vibe-badge">⚡ Vibe Coded</span>' : ''}
              </div>
              <a class="project-detail-link" href="${project.url}" target="_blank" rel="noopener noreferrer">
                Visit →
              </a>
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
