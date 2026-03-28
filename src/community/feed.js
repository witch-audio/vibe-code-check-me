/**
 * Community feed — lists all submitted projects.
 */

import { convex, isLoggedIn, loginWithGitHub } from '../lib/convex.js';
import { api } from '../../convex/_generated/api.js';

function timeAgo(ms) {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TAG_LABELS = {
  first_impressions: 'First impressions',
  ui_ux: 'UI / UX',
  bugs: 'Bugs',
  features: 'Feature ideas',
};

function renderProjectCard(project, onNavigate) {
  const card = document.createElement('button');
  card.className = 'project-card';
  card.innerHTML = `
    <div class="project-card-thumb-wrap">
      <img
        class="project-card-thumb"
        src="https://image.thum.io/get/width/640/crop/360/${project.url}"
        alt="${project.name} screenshot"
        onerror="this.parentElement.style.display='none'"
      />
    </div>
    <div class="project-card-content">
      <div class="project-card-top">
        <span class="project-card-name">${project.name}</span>
        ${project.vibeCoded ? '<span class="vibe-badge">⚡ Vibe Coded</span>' : ''}
      </div>
      <div class="project-card-meta">
        <img class="project-card-avatar" src="${project.githubAvatarUrl}" alt="${project.githubUsername}" />
        <span class="project-card-username">@${project.githubUsername}</span>
        <span class="project-card-date">· ${timeAgo(project._creationTime)}</span>
      </div>
      <p class="project-card-desc">${project.description}</p>
      <div class="project-card-footer">
        <div class="feedback-tags">
          ${project.feedbackWants.map(t => `<span class="feedback-tag">${TAG_LABELS[t] ?? t}</span>`).join('')}
        </div>
        <span class="project-card-cta">${project.feedbackCount} feedback →</span>
      </div>
    </div>
  `;
  card.addEventListener('click', () => onNavigate(project.slug));
  return card;
}

export function initFeed(onNavigateToProject, onNavigateToSubmit, onBack) {
  const feedEl = document.getElementById('projects-feed');

  let unsubscribe = null;

  return {
    show() {
      feedEl.innerHTML = '<p class="feed-loading">Loading projects...</p>';

      unsubscribe = convex.onUpdate(api.projects.list, {}, (projects) => {
        if (!projects || projects.length === 0) {
          feedEl.innerHTML = '<p class="feed-empty">No projects yet. Be the first to submit!</p>';
          return;
        }
        feedEl.innerHTML = '';
        const list = document.createElement('div');
        list.className = 'project-list';
        projects.forEach(p => list.appendChild(renderProjectCard(p, onNavigateToProject)));
        feedEl.appendChild(list);
      });
    },
    hide() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
  };
}
