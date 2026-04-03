/**
 * context-guard scoring logic — ported to browser.
 * Fetches markdown files from a public GitHub repo and
 * evaluates coverage across 6 guardrail categories.
 */

const API_BASE = 'https://api.github.com';
const FETCH_BATCH_SIZE = 4;
const FETCH_BATCH_DELAY_MS = 250;

const CONTEXT_FILES = ['AGENTS.md', 'CLAUDE.md', 'MEMORY.md', 'SOUL.md', 'USER.md'];

// Extensions worth scanning for keyword coverage
const SCAN_EXTENSIONS = new Set([
  '.md', '.txt', '.rst',                              // docs
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',       // JS/TS
  '.py', '.rb', '.go', '.rs', '.java', '.cs', '.php', // other langs
  '.json', '.yaml', '.yml', '.toml', '.env',           // config
  '.sh', '.bash', '.zsh',                              // scripts
  '.dockerfile', '',                                   // infra (Dockerfile has no ext)
]);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', 'vendor']);
const SKIP_PATTERNS = ['.min.js', '.min.css', '.lock', '-lock.json', '.map', '.snap'];

// Filenames that get priority fetching regardless of extension
const PRIORITY_FILES = new Set([
  'agents.md', 'claude.md', 'readme.md', 'memory.md', 'soul.md', 'user.md',
  'package.json', 'docker-compose.yml', 'docker-compose.yaml', 'dockerfile',
  '.env.example', '.env.template', '.env.sample',
  '.gitignore', '.github', 'security.md', 'contributing.md',
]);

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBatchedTasks(items, worker, options = {}) {
  const batchSize = options.batchSize ?? FETCH_BATCH_SIZE;
  const delayMs = options.delayMs ?? FETCH_BATCH_DELAY_MS;
  const results = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...await Promise.allSettled(batch.map((item) => worker(item))));

    if (index + batchSize < items.length && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return results;
}

/**
 * Decode GitHub's base64 file content (handles line-wrapped base64).
 */
function decodeContent(b64) {
  return atob(b64.replace(/\s/g, ''));
}

function fileScore(path) {
  const lower = path.toLowerCase();
  const name = lower.split('/').pop();
  const ext = name.includes('.') ? '.' + name.split('.').pop() : '';

  // Skip unwanted paths
  const parts = lower.split('/');
  if (parts.some(p => SKIP_DIRS.has(p))) return -1;
  if (SKIP_PATTERNS.some(p => lower.endsWith(p))) return -1;
  if (lower.startsWith('.git/')) return -1;

  // Score: higher = fetch sooner
  let score = 0;
  if (PRIORITY_FILES.has(name)) score += 100;
  if (name.endsWith('.md')) score += 50;
  if (name === 'package.json' || name === 'dockerfile') score += 60;
  if (ext === '.env' || name.startsWith('.env')) score += 60;
  if (ext === '.yml' || ext === '.yaml') score += 30;
  if (ext === '.json') score += 20;
  if (SCAN_EXTENSIONS.has(ext)) score += 10;

  // Context files in root get a boost
  if (!path.includes('/')) score += 20;

  return score;
}

/**
 * Scan entire repo using the Git Trees API, then fetch the most relevant files.
 * Always scans the full repo — not just markdown.
 */
async function fetchRepoFiles(owner, repo) {
  // Get default branch
  const repoMeta = await ghGet(`/repos/${owner}/${repo}`);
  const branch = repoMeta.default_branch || 'main';

  // Get full file tree in one API call
  const tree = await ghGet(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
  const allFiles = (tree.tree || []).filter(f => f.type === 'blob');

  // Score and sort — take top 40 files
  const ranked = allFiles
    .map(f => ({ ...f, score: fileScore(f.path) }))
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  if (ranked.length === 0) throw new Error('No scannable files found in this repository.');

  // Fetch content of selected files (skip files >100 KB to avoid rate limit waste)
  const fetched = [];
  await runBatchedTasks(ranked, async (f) => {
    try {
      if (f.size > 102400) return;
      const data = await ghGet(`/repos/${owner}/${repo}/contents/${f.path}`);
      if (data.content) {
        fetched.push({ name: f.path, content: decodeContent(data.content) });
      }
    } catch {
      // Skip files that fail individually so one bad fetch does not stop the scan.
    }
  });

  // Determine scan mode label
  const hasContextFiles = fetched.some(f =>
    CONTEXT_FILES.map(c => c.toLowerCase()).includes(f.name.toLowerCase().split('/').pop())
  );
  const scanMode = hasContextFiles ? 'full-repo + context files' : 'full-repo scan';

  return { files: fetched, scanMode };
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
  const { files, scanMode } = await fetchRepoFiles(owner, repo);

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
