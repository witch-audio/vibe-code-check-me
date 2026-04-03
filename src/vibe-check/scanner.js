/**
 * context-guard scoring logic — ported to browser.
 * Fetches markdown files from a public GitHub repo and
 * evaluates coverage across 6 guardrail categories.
 */

const API_BASE = 'https://api.github.com';

const TARGET_FILES = ['AGENTS.md', 'CLAUDE.md', 'README.md', 'MEMORY.md', 'SOUL.md', 'USER.md'];

const CATEGORIES = [
  {
    id: 'setup_run_commands',
    label: 'Setup/Run Commands',
    badge: 'SETUP',
    keywords: ['install', 'setup', 'run', 'start', 'quick start', 'usage', 'npm', 'pnpm', 'yarn', 'node'],
    recommendation: 'Add exact setup and run commands (copy/paste ready), including one local quick-start path.',
  },
  {
    id: 'architecture_context',
    label: 'Architecture/Context',
    badge: 'ARCH',
    keywords: ['architecture', 'context', 'overview', 'system', 'components', 'workflow', 'mission', 'purpose', 'scope'],
    recommendation: 'Add a short project overview: purpose, key files, and how the parts fit together.',
  },
  {
    id: 'coding_testing_standards',
    label: 'Coding/Testing Standards',
    badge: 'STANDARDS',
    keywords: ['code style', 'convention', 'lint', 'format', 'test', 'testing', 'unit test', 'integration test', 'review', 'quality'],
    recommendation: 'Document coding rules and testing expectations (what must pass before shipping).',
  },
  {
    id: 'security_privacy_guardrails',
    label: 'Security/Privacy Guardrails',
    badge: 'SECURITY',
    keywords: ['security', 'privacy', 'secret', 'token', 'api key', 'credential', 'sensitive', 'permission', 'guardrail', 'leak'],
    recommendation: 'State what sensitive data must never be committed and how to handle credentials safely.',
  },
  {
    id: 'performance_time_constraints',
    label: 'Performance/Time Constraints',
    badge: 'PERF',
    keywords: ['performance', 'latency', 'timeout', 'memory', 'limit', 'timebox', '2-4 hours', '2–4 hours', 'scope cap', 'fast'],
    recommendation: 'Define performance limits and time/scope limits so work stays focused and fast.',
  },
  {
    id: 'deployment_account_guardrails',
    label: 'Deployment/Account Guardrails',
    badge: 'DEPLOY',
    keywords: ['deploy', 'deployment', 'publish', 'release', 'github', 'vercel', 'owner', 'account', 'team', 'auth'],
    recommendation: 'Add deployment rules and account ownership checks (where and who is allowed to ship).',
  },
];

/**
 * Parse "owner/repo" or "https://github.com/owner/repo" → { owner, repo }
 * Throws a user-friendly Error on bad input.
 */
export function parseRepo(input) {
  const cleaned = input.trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error('Enter a GitHub repo as owner/repo or github.com/owner/repo');
  }
  return { owner: parts[0], repo: parts[1] };
}

async function ghGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });
  if (res.status === 404) throw new Error('Repo not found or is private');
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset');
    const mins = reset ? Math.ceil((Number(reset) * 1000 - Date.now()) / 60000) : '?';
    throw new Error(`GitHub rate limit reached. Try again in ~${mins} min.`);
  }
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

/**
 * Decode GitHub's base64 file content (handles line-wrapped base64).
 */
function decodeContent(b64) {
  return atob(b64.replace(/\s/g, ''));
}

/**
 * Fetch named context files first; fall back to all .md files ≤2 levels deep.
 */
async function fetchMarkdownFiles(owner, repo) {
  const found = [];

  // Named-file pass
  await Promise.allSettled(
    TARGET_FILES.map(async (filename) => {
      try {
        const data = await ghGet(`/repos/${owner}/${repo}/contents/${filename}`);
        if (data.type === 'file' && data.content) {
          found.push({ name: filename, content: decodeContent(data.content) });
        }
      } catch { /* file doesn't exist — skip */ }
    })
  );

  if (found.length > 0) return { files: found, scanMode: 'named-context-files' };

  // Fallback: root listing → collect .md files, recurse one level into dirs
  const fallback = [];
  const root = await ghGet(`/repos/${owner}/${repo}/contents/`);
  const mdFiles = root.filter(f => f.type === 'file' && f.name.endsWith('.md'));
  const dirs = root.filter(f => f.type === 'dir' && !f.name.startsWith('.') && f.name !== 'node_modules');

  const subResults = await Promise.allSettled(
    dirs.slice(0, 10).map(d => ghGet(`/repos/${owner}/${repo}/contents/${d.name}`))
  );
  const subFiles = subResults.flatMap(r =>
    r.status === 'fulfilled' ? r.value.filter(f => f.type === 'file' && f.name.endsWith('.md')) : []
  );

  const allMd = [...mdFiles, ...subFiles].slice(0, 20);

  await Promise.allSettled(
    allMd.map(async (f) => {
      try {
        const data = await ghGet(`/repos/${owner}/${repo}/contents/${f.path}`);
        if (data.content) fallback.push({ name: f.path, content: decodeContent(data.content) });
      } catch { /* skip */ }
    })
  );

  return { files: fallback, scanMode: 'fallback-markdown' };
}

function evaluateCategory(cat, corpusLower) {
  const matched = cat.keywords.filter(kw => corpusLower.includes(kw));
  const count = matched.length;
  const ratio = count / cat.keywords.length;
  let status, score;
  if (count >= 3 || ratio >= 0.35) { status = 'PASS'; score = 100; }
  else if (count >= 1)             { status = 'PARTIAL'; score = 60; }
  else                              { status = 'MISSING'; score = 0; }
  return {
    id: cat.id,
    label: cat.label,
    badge: cat.badge,
    status,
    score,
    matchedKeywords: matched,
    recommendation: cat.recommendation,
  };
}

/**
 * Main entry point.
 * @param {string} repoInput - "owner/repo" or full GitHub URL
 */
export async function scanRepo(repoInput) {
  const { owner, repo } = parseRepo(repoInput);
  const { files, scanMode } = await fetchMarkdownFiles(owner, repo);

  if (files.length === 0) {
    throw new Error('No markdown files found in this repo to scan.');
  }

  const corpus = files.map(f => f.content).join('\n').toLowerCase();
  const categories = CATEGORIES.map(cat => evaluateCategory(cat, corpus));
  const overallScore = Math.round(categories.reduce((s, c) => s + c.score, 0) / categories.length);

  return {
    repo: `${owner}/${repo}`,
    overallScore,
    scanMode,
    scannedFiles: files.map(f => f.name),
    categories,
  };
}

export { CATEGORIES };
