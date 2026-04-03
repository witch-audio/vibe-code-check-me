/**
 * Flow Controller — manages landing → loading → story card experience.
 * Replaces the old terminal-based interface with a Spotify Wrapped-style flow.
 */

import { appState } from './state.js';
import { buildDeveloperProfile } from './github-api.js';
import { generateMoodCards } from './features/mood-ring/mood-ring.js';
import { generateSoulmateCards } from './features/soulmate/soulmate.js';
import { generateAuraCards } from './features/aura/aura.js';
import { generateRoastCards } from './features/roast/roast.js';
import { generateSpotifyCards } from './features/spotify/spotify.js';

let currentCardIndex = 0;
let totalCards = 0;
let storyCards = [];

const LOADING_MESSAGES = [
  'Scanning your repos...',
  'Reading your commit history...',
  'Analyzing your languages...',
  'Calculating your vibe...',
  'Mapping your coding style...',
  'Almost there...',
];

export function initTerminal(switchScreen) {
  const input = document.getElementById('username-input');
  const btn = document.getElementById('connect-btn');
  const error = document.getElementById('landing-error');

  // Landing: connect flow
  btn.addEventListener('click', () => handleConnect(input, btn, error));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleConnect(input, btn, error);
    error.textContent = '';
  });

  // Story navigation — click position based (left 30% = prev, right 70% = next)
  // Ignores clicks on interactive elements so links/buttons work
  document.getElementById('story-cards').addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, .end-actions')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.3) prevCard();
    else nextCard();
  });
  document.getElementById('story-close').addEventListener('click', backToLanding);
  document.getElementById('story-share-btn').addEventListener('click', shareCurrentCard);

  // Keyboard nav
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('stories').classList.contains('active')) return;
    if (e.key === 'ArrowRight' || e.key === ' ') nextCard();
    if (e.key === 'ArrowLeft') prevCard();
    if (e.key === 'Escape') backToLanding();
  });

  // Touch swipe support
  let touchStartX = 0;
  document.getElementById('stories').addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  document.getElementById('stories').addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) nextCard();
      else prevCard();
    }
  }, { passive: true });

  // Check for cached profile
  if (appState.isConnected()) {
    input.value = appState.getProfile().username;
  }
}

async function handleConnect(input, btn, error) {
  const username = input.value.trim().replace(/^@/, '');
  if (!username) {
    error.textContent = 'Enter a GitHub username to get started';
    input.focus();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Loading...';
  error.textContent = '';

  // Switch to loading screen
  switchScreen('loading-screen');
  animateLoadingText();

  try {
    const profile = await buildDeveloperProfile(username);
    appState.setProfile(profile);
    await buildStoryCards(profile);
    switchScreen('stories');
    showCard(0);
  } catch (err) {
    if (err.message.includes('Rate limit')) {
      showRateLimitScreen(err.message);
    } else {
      switchScreen('landing');
      error.textContent = err.message;
    }
    btn.disabled = false;
    btn.textContent = "Let's go";
  }
}

function animateLoadingText() {
  const el = document.getElementById('loading-text');
  let i = 0;
  const interval = setInterval(() => {
    if (!document.getElementById('loading-screen').classList.contains('active')) {
      clearInterval(interval);
      return;
    }
    el.textContent = LOADING_MESSAGES[i % LOADING_MESSAGES.length];
    i++;
  }, 1500);
}

async function buildStoryCards(profile) {
  const container = document.getElementById('story-cards');
  container.innerHTML = '';

  // Generate cards from each feature
  const profileCards = generateProfileCards(profile);
  const moodCards = generateMoodCards(profile);

  // AI-powered features — run in parallel, gracefully skip failures
  const [soulmateCards, auraCards, roastCards, spotifyCards] = await Promise.all([
    generateSoulmateCards(profile).catch(() => []),
    generateAuraCards(profile).catch(() => []),
    generateRoastCards(profile).catch(() => []),
    generateSpotifyCards(profile).catch(() => []),
  ]);

  const endCard = generateEndCard(profile);

  storyCards = [
    ...profileCards,
    ...moodCards,
    ...auraCards,
    ...roastCards,
    ...soulmateCards,
    ...spotifyCards,
    endCard,
  ];
  totalCards = storyCards.length;

  // Render cards to DOM
  storyCards.forEach((card, i) => {
    const el = document.createElement('div');
    el.className = 'story-card';
    el.dataset.theme = card.theme;
    el.innerHTML = `
      <div class="card-glow glow-1"></div>
      <div class="card-glow glow-2"></div>
      <div class="card-inner">${card.html}</div>
    `;
    container.appendChild(el);
  });

  // Wire up end-screen buttons via event delegation
  container.addEventListener('click', (e) => {
    if (e.target.id === 'end-restart') {
      backToLanding();
      document.getElementById('username-input').value = '';
      document.getElementById('username-input').focus();
    }
  });

  // Build progress bar
  const progress = document.getElementById('story-progress');
  progress.innerHTML = '';
  for (let i = 0; i < totalCards; i++) {
    const seg = document.createElement('div');
    seg.className = 'progress-segment';
    seg.innerHTML = '<div class="progress-fill"></div>';
    progress.appendChild(seg);
  }
}

function generateProfileCards(profile) {
  const topLangs = Object.entries(profile.languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const langColors = ['c0', 'c1', 'c2', 'c3', 'c4'];

  const langBars = topLangs.map(([lang, pct], i) => `
    <div class="lang-row">
      <span class="lang-name">${lang}</span>
      <div class="lang-bar-track">
        <div class="lang-bar-fill ${langColors[i]}" style="width: ${pct}%;"></div>
      </div>
      <span class="lang-pct">${pct}%</span>
    </div>
  `).join('');

  // Card 1: Profile overview
  const card1 = {
    theme: 'profile',
    html: `
      <img class="story-avatar" src="${profile.avatarUrl}" alt="${profile.username}" />
      <div class="card-eyebrow">YOUR DEVELOPER WRAPPED</div>
      <div class="card-headline">${profile.username}</div>
      <p class="card-body">${profile.bio || 'A developer doing their thing on GitHub.'}</p>
      <div class="stat-grid">
        <div class="stat-cell">
          <div class="num">${profile.publicRepos}</div>
          <div class="label">Repos</div>
        </div>
        <div class="stat-cell">
          <div class="num">${profile.totalStars}</div>
          <div class="label">Stars</div>
        </div>
        <div class="stat-cell">
          <div class="num">${profile.followers}</div>
          <div class="label">Followers</div>
        </div>
        <div class="stat-cell">
          <div class="num">${profile.accountAge}y</div>
          <div class="label">On GitHub</div>
        </div>
      </div>
    `,
  };

  // Card 2: Languages
  const card2 = {
    theme: 'languages',
    html: `
      <div class="card-eyebrow">YOUR TOP LANGUAGES</div>
      <div class="card-headline lang-hero">${topLangs.length > 0 ? topLangs[0][0] : 'Code'}</div>
      <p class="card-body">is your #1 language</p>
      <div class="lang-list">${langBars}</div>
    `,
  };

  return [card1, card2];
}

function generateEndCard(profile) {
  const totalLangs = Object.keys(profile.languages).length;
  const cardsViewed = totalCards || 8;

  return {
    theme: 'end',
    html: `
      <div class="end-emoji">&#127881;</div>
      <div class="card-eyebrow">THAT'S A WRAP</div>
      <div class="card-headline">That's<br>A Wrap</div>
      <div class="end-stats">
        <div class="end-stat">
          <div class="num">${profile.publicRepos}</div>
          <div class="label">Repos</div>
        </div>
        <div class="end-stat">
          <div class="num">${totalLangs}</div>
          <div class="label">Languages</div>
        </div>
        <div class="end-stat">
          <div class="num">${profile.totalStars}</div>
          <div class="label">Stars</div>
        </div>
      </div>
      <p class="end-tagline">Keep shipping. Keep vibing.</p>
      <div class="end-actions">
        <button class="end-btn primary" id="end-restart">Check Another Dev</button>
      </div>
      <div class="end-credit">
        <a href="https://vibecodecheck.me" target="_blank">vibecodecheck.me</a> · by <a href="https://twitter.com/witchaudio_" target="_blank">@witchaudio_</a>
      </div>
    `,
  };
}

function launchConfetti() {
  const container = document.querySelector('.story-card.active');
  if (!container || container.querySelector('.confetti-piece')) return;

  const colors = ['#1DB954', '#1ed760', '#a335ee', '#ff8c00', '#00bfff', '#ffd700', '#ff4081', '#ffffff'];
  const shapes = ['circle', 'square', 'strip'];

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = `confetti-piece confetti-${shapes[i % 3]}`;
    const drift = (Math.random() - 0.5) * 200;
    piece.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay: ${Math.random() * 2}s;
      animation-duration: ${2.5 + Math.random() * 2}s;
      --drift: ${drift}px;
    `;
    container.appendChild(piece);
  }

  // Clean up after animations finish
  setTimeout(() => {
    container.querySelectorAll('.confetti-piece').forEach(p => p.remove());
  }, 6000);
}

function showCard(index) {
  if (index < 0 || index >= totalCards) return;
  currentCardIndex = index;

  const isLastCard = index === totalCards - 1;

  // Update cards — re-trigger animation by removing then adding active
  const cards = document.querySelectorAll('.story-card');
  cards.forEach((card, i) => {
    if (i === index) {
      card.classList.remove('active');
      void card.offsetWidth;
      card.classList.add('active');
      card.scrollTop = 0;
    } else {
      card.classList.remove('active');
    }
  });

  // Launch confetti on end card
  if (isLastCard) launchConfetti();

  // Update progress
  const segments = document.querySelectorAll('.progress-segment');
  segments.forEach((seg, i) => {
    seg.classList.remove('complete', 'active');
    if (i < index) seg.classList.add('complete');
    if (i === index) seg.classList.add('active');
  });

  // Update counter
  document.getElementById('story-counter').textContent = `${index + 1} / ${totalCards}`;
}

function nextCard() {
  if (currentCardIndex < totalCards - 1) {
    showCard(currentCardIndex + 1);
  }
}

function prevCard() {
  if (currentCardIndex > 0) {
    showCard(currentCardIndex - 1);
  }
}

function showRateLimitScreen(message) {
  const jokes = [
    "GitHub said 'new phone, who dis?' Try again later.",
    "You're so popular even the API needs a break from you.",
    "Looks like you vibe-checked too hard. GitHub needs a moment.",
    "The API is taking a coffee break. It's not you, it's the rate limit.",
    "Congrats, you broke GitHub's patience. That's actually impressive.",
    "GitHub's API went to lunch. It didn't invite us.",
    "Too many vibes, not enough API calls. Classic vibe coder problem.",
    "Even APIs need self-care days. This is one of those.",
    "You've been rate limited. Time to touch grass and come back.",
    "The API whispered 'I need space.' Respect the boundary.",
  ];
  const joke = jokes[Math.floor(Math.random() * jokes.length)];

  // Extract minutes from error message
  const minMatch = message.match(/~(\d+) min/);
  const mins = minMatch ? minMatch[1] : '??';

  const container = document.getElementById('story-cards');
  container.innerHTML = '';

  const el = document.createElement('div');
  el.className = 'story-card active';
  el.dataset.theme = 'ratelimit';
  el.innerHTML = `
    <div class="card-glow glow-1"></div>
    <div class="card-glow glow-2"></div>
    <div class="card-inner">
      <div class="ratelimit-emoji">&#9203;</div>
      <div class="card-eyebrow">WHOA THERE</div>
      <div class="card-headline">Too Many<br>Vibes</div>
      <p class="card-body ratelimit-joke">${joke}</p>
      <div class="ratelimit-timer">
        <span class="ratelimit-mins">${mins}</span>
        <span class="ratelimit-label">minutes until reset</span>
      </div>
      <button class="end-btn primary" id="ratelimit-back">Back to Landing</button>
    </div>
  `;
  container.appendChild(el);

  // Hide progress bar for this screen
  document.getElementById('story-progress').innerHTML = '';
  document.getElementById('story-counter').textContent = '';

  el.addEventListener('click', (e) => {
    if (e.target.id === 'ratelimit-back') backToLanding();
  });

  switchScreen('stories');
}

function backToLanding() {
  switchScreen('landing');
  const btn = document.getElementById('connect-btn');
  btn.disabled = false;
  btn.textContent = "Let's go";
}

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function shareCurrentCard() {
  const activeCard = document.querySelector('.story-card.active');
  if (!activeCard) return;

  const btn = document.getElementById('story-share-btn');
  const original = btn.textContent;
  btn.textContent = 'Saving...';

  try {
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const canvas = await window.html2canvas(activeCard, {
      backgroundColor: '#0a0a0a',
      scale: 2,
      useCORS: true,
    });

    const link = document.createElement('a');
    link.download = `vibe-wrapped-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    btn.textContent = 'Saved!';
    setTimeout(() => { btn.textContent = original; }, 2000);
  } catch {
    btn.textContent = 'Failed';
    setTimeout(() => { btn.textContent = original; }, 2000);
  }
}
