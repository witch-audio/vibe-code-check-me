/**
 * Vibe Check UI — manages input / loading / results states
 * for the #vibe-check screen.
 */

import { scanRepo, parseRepo } from './scanner.js';

const SHIELD_SVG = `<svg class="vc-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  <path d="m9 12 2 2 4-4"/>
</svg>`;

const BADGE_CLASSES = {
  SETUP:     'vc-badge-setup',
  ARCH:      'vc-badge-arch',
  STANDARDS: 'vc-badge-standards',
  SECURITY:  'vc-badge-security',
  PERF:      'vc-badge-perf',
  DEPLOY:    'vc-badge-deploy',
};

const BADGE_LABELS = ['SETUP', 'ARCH', 'STANDARDS', 'SECURITY', 'PERF', 'DEPLOY'];

function renderInputState(container, onScan) {
  container.innerHTML = `
    <div class="vc-hero">
      ${SHIELD_SVG}
      <h1 class="vc-title">VIBE CODE CHECK</h1>
      <p class="vc-subtitle">Security scanner for AI-generated code</p>
      <div class="vc-badge-row">
        ${BADGE_LABELS.map(b => `<span class="vc-badge ${BADGE_CLASSES[b]}">${b}</span>`).join('')}
      </div>
      <div class="vc-input-group">
        <div class="vc-input-wrapper">
          <svg class="vc-input-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <input
            class="vc-input"
            id="vc-repo-input"
            type="text"
            placeholder="github.com/owner/repo"
            autocomplete="off"
            spellcheck="false"
            aria-label="GitHub repository URL"
          />
        </div>
        <button class="vc-scan-btn" id="vc-scan-btn">Scan Repo</button>
      </div>
      <p class="vc-error" id="vc-error" role="alert" aria-live="polite"></p>
    </div>
  `;

  const input = container.querySelector('#vc-repo-input');
  const btn = container.querySelector('#vc-scan-btn');
  const errorEl = container.querySelector('#vc-error');

  function clearError() { errorEl.textContent = ''; }
  function showError(msg) { errorEl.textContent = msg; }

  async function startScan() {
    const val = input.value.trim();
    if (!val) { showError('Enter a GitHub repo first.'); return; }
    try {
      parseRepo(val);
    } catch (e) {
      showError(e.message);
      return;
    }
    clearError();
    btn.disabled = true;
    await onScan(val);
  }

  btn.addEventListener('click', startScan);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') startScan(); });
  input.focus();
}

function renderLoadingState(container, repo) {
  container.innerHTML = `
    <div class="vc-loading">
      <div class="vc-loading-ring"></div>
      <p class="vc-loading-label">Scanning repository…</p>
      <p class="vc-loading-repo">${escapeHtml(repo)}</p>
    </div>
  `;
}

function buildScoreRingSVG(score) {
  const r = 40;
  const cx = 52, cy = 52;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;
  const gap = circumference - dash;
  const color = score >= 70 ? '#1DB954' : score >= 40 ? '#f5c518' : '#e8115b';

  return `
    <svg width="104" height="104" viewBox="0 0 104 104" aria-label="Score: ${score} out of 100">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="8"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
        stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
        stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})"
      />
      <text x="${cx}" y="${cy - 7}" style="font-family:var(--font-display);font-size:28px;fill:${color};dominant-baseline:middle;text-anchor:middle;">${score}</text>
      <text x="${cx}" y="${cy + 14}" style="font-size:11px;fill:var(--gray-300);dominant-baseline:middle;text-anchor:middle;">/ 100</text>
    </svg>
  `;
}

function statusClass(status) {
  if (status === 'PASS')    return 'pass';
  if (status === 'PARTIAL') return 'partial';
  return 'missing';
}

function statusIcon(status) {
  if (status === 'PASS')    return `<span class="vc-status-icon vc-status-pass" aria-label="Pass">✓</span>`;
  if (status === 'PARTIAL') return `<span class="vc-status-icon vc-status-partial" aria-label="Partial">~</span>`;
  return `<span class="vc-status-icon vc-status-missing" aria-label="Missing">✗</span>`;
}

function renderResultsState(container, result, onReset) {
  const badgesHtml = result.categories.map(c => {
    const cls = BADGE_CLASSES[c.badge] || '';
    const statusCls = `vc-status-tag-${statusClass(c.status)}`;
    return `<span class="vc-badge ${cls} ${statusCls}">${c.badge}</span>`;
  }).join('');

  const categoriesHtml = result.categories.map((c, i) => `
    <div class="vc-category-card" data-idx="${i}" role="button" tabindex="0" aria-expanded="false">
      <div class="vc-category-row">
        ${statusIcon(c.status)}
        <span class="vc-category-label">${escapeHtml(c.label)}</span>
        <span class="vc-category-status vc-status-tag-${statusClass(c.status)}">${c.status}</span>
        <span class="vc-expand-icon" aria-hidden="true">▾</span>
      </div>
      <div class="vc-category-detail" aria-hidden="true">
        ${c.matchedKeywords.length > 0
          ? `<p class="vc-keyword-list"><strong>Matched:</strong> ${escapeHtml(c.matchedKeywords.join(', '))}</p>`
          : `<p class="vc-keyword-list" style="color:var(--gray-400)">No keywords matched.</p>`
        }
        <p class="vc-recommendation">${escapeHtml(c.recommendation)}</p>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="vc-results">
      <div class="vc-result-header">
        <div class="vc-result-info">
          <div class="vc-result-repo">${escapeHtml(result.repo)}</div>
          <div class="vc-result-sub">Security scanner for AI-generated code</div>
          <div class="vc-result-badges">${badgesHtml}</div>
        </div>
        <div class="vc-score-ring">
          ${buildScoreRingSVG(result.overallScore)}
          <div class="vc-score-label">Overall Score</div>
        </div>
      </div>

      ${categoriesHtml}

      <p class="vc-scan-info">
        Scanned <span>${result.scannedFiles.length} file${result.scannedFiles.length !== 1 ? 's' : ''}</span>
        · ${result.scanMode === 'named-context-files' ? 'context files' : 'markdown fallback'}<br>
        <span>${escapeHtml(result.scannedFiles.join(', '))}</span>
      </p>

      <button class="vc-reset-btn" id="vc-reset-btn">Scan Another Repo</button>
    </div>
  `;

  // Expand/collapse category cards
  container.querySelectorAll('.vc-category-card').forEach(card => {
    function toggle() {
      const expanded = card.classList.toggle('expanded');
      card.setAttribute('aria-expanded', String(expanded));
      card.querySelector('.vc-category-detail').setAttribute('aria-hidden', String(!expanded));
    }
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  container.querySelector('#vc-reset-btn').addEventListener('click', onReset);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function initVibeCheck() {
  const container = document.getElementById('vibe-check');

  function showInput() {
    renderInputState(container, handleScan);
  }

  async function handleScan(repoInput) {
    renderLoadingState(container, repoInput);
    try {
      const result = await scanRepo(repoInput);
      renderResultsState(container, result, showInput);
    } catch (err) {
      renderInputState(container, handleScan);
      const errEl = container.querySelector('#vc-error');
      if (errEl) errEl.textContent = err.message;
      const input = container.querySelector('#vc-repo-input');
      if (input) { input.value = repoInput; input.focus(); }
    }
  }

  showInput();

  return { show: showInput };
}
