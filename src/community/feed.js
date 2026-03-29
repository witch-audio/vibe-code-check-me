/**
 * Community feed — lists all submitted projects.
 * Supports list view (default) and grid view, toggled by user.
 */

import { convex } from '../lib/convex.js';
import { api } from '../../convex/_generated/api.js';

const VIEW_KEY = 'vcc_view';

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

function renderListCard(project, onNavigate) {
  const card = document.createElement('button');
  card.className = 'project-card project-card--list';
  card.innerHTML = `
    <img class="project-list-avatar" src="${project.githubAvatarUrl}" alt="${project.githubUsername}" />
    <div class="project-list-body">
      <div class="project-list-top">
        <span class="project-card-name">${project.name}</span>
        ${project.vibeCoded ? '<span class="vibe-badge">⚡ Vibe Coded</span>' : ''}
        <span class="project-list-byline">@${project.githubUsername} · ${timeAgo(project._creationTime)}</span>
      </div>
      <p class="project-list-desc">${project.description}</p>
      <div class="project-list-footer">
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

function renderGridCard(project, onNavigate) {
  const card = document.createElement('button');
  card.className = 'project-card project-card--grid';
  card.innerHTML = `
    <div class="project-card-thumb-wrap">
      <img
        class="project-card-thumb"
        src="https://s0.wordpress.com/mshots/v1/${encodeURIComponent(project.url)}?w=400&h=400"
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

export function initFeed(onNavigateToProject) {
  const feedEl = document.getElementById('projects-feed');
  let unsubscribe = null;
  let currentProjects = null;
  let viewMode = localStorage.getItem(VIEW_KEY) || 'list';

  // Wire up toggle buttons (already in DOM via index.html)
  const listBtn = document.getElementById('view-list-btn');
  const gridBtn = document.getElementById('view-grid-btn');

  function setView(mode) {
    viewMode = mode;
    localStorage.setItem(VIEW_KEY, mode);
    listBtn.classList.toggle('active', mode === 'list');
    gridBtn.classList.toggle('active', mode === 'grid');
    if (currentProjects) renderProjects(currentProjects);
  }

  listBtn.addEventListener('click', () => setView('list'));
  gridBtn.addEventListener('click', () => setView('grid'));
  setView(viewMode); // apply saved preference immediately

  function renderProjects(projects) {
    if (!projects || projects.length === 0) {
      feedEl.innerHTML = '<p class="feed-empty">No projects yet. Be the first to submit!</p>';
      return;
    }
    feedEl.innerHTML = '';
    const container = document.createElement('div');
    container.className = viewMode === 'grid' ? 'project-grid' : 'project-list-view';
    const render = viewMode === 'grid' ? renderGridCard : renderListCard;
    projects.forEach(p => container.appendChild(render(p, onNavigateToProject)));
    feedEl.appendChild(container);
  }

  return {
    show() {
      if (unsubscribe) return; // already subscribed
      feedEl.innerHTML = '<p class="feed-loading">Loading projects...</p>';

      unsubscribe = convex.onUpdate(api.projects.list, {}, (projects) => {
        currentProjects = projects;
        renderProjects(projects);
      });
    },
    hide() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
        currentProjects = null;
      }
    },
  };
}
