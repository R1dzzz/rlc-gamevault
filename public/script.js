/* ============================================================
   RLC GameVault — Frontend Logic
   script.js
   ============================================================ */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  games:       [],
  page:        1,
  totalCount:  0,
  hasMore:     false,
  loading:     false,
  activeGenre: '',
  searchQuery: '',
  activeTab:   'home',
};

// ── DOM refs ──────────────────────────────────────────────────────────────
const grid          = document.getElementById('game-grid');
const emptyState    = document.getElementById('empty-state');
const loadMoreWrap  = document.getElementById('load-more-wrap');
const loadMoreBtn   = document.getElementById('load-more-btn');
const sectionLabel  = document.getElementById('section-label');
const sectionCount  = document.getElementById('section-count');
const searchInput   = document.getElementById('search-input');
const searchClear   = document.getElementById('search-clear');
const filterPills   = document.querySelectorAll('.filter-pill');
const navItems      = document.querySelectorAll('.nav-item');
const modalOverlay  = document.getElementById('modal-overlay');
const modalClose    = document.getElementById('modal-close');
const toast         = document.getElementById('toast');

// ── Utilities ─────────────────────────────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

function showToast(msg, duration = 2200) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function ratingStars(rating) {
  if (!rating) return '—';
  return `★ ${rating.toFixed(1)}`;
}

// ── Skeleton loader ───────────────────────────────────────────────────────
function renderSkeletons(count = 10) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'skeleton';
    el.innerHTML = `
      <div class="skeleton-img shimmer"></div>
      <div class="skeleton-body">
        <div class="shimmer" style="height:12px;width:80%;margin-bottom:6px;border-radius:4px;"></div>
        <div class="shimmer" style="height:10px;width:50%;border-radius:4px;"></div>
      </div>`;
    frag.appendChild(el);
  }
  grid.innerHTML = '';
  grid.appendChild(frag);
}

// ── Card rendering ─────────────────────────────────────────────────────────
function renderGameCard(game, index) {
  const card = document.createElement('div');
  card.className = 'game-card';
  card.style.animationDelay = `${index * 40}ms`;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `View details for ${game.name}`);

  const imgSrc = game.background_image || '';
  const tagHtml = (game.genres || []).slice(0, 2).map(
    t => `<span class="card-tag">${t}</span>`
  ).join('');

  card.innerHTML = `
    <div class="card-img-wrap">
      ${imgSrc
        ? `<img src="${imgSrc}" alt="${escapeHtml(game.name)}" loading="lazy"
               onerror="this.style.display='none'" />`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2rem;">🎮</div>`
      }
      ${game.rating ? `<div class="card-rating-badge">${ratingStars(game.rating)}</div>` : ''}
    </div>
    <div class="card-body">
      <div class="card-title">${escapeHtml(game.name)}</div>
      <div class="card-tags">${tagHtml}</div>
    </div>`;

  card.addEventListener('click', () => openModal(game));
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openModal(game); });
  return card;
}

function escapeHtml(str = '') {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function appendCards(games, startIndex = 0) {
  const frag = document.createDocumentFragment();
  games.forEach((g, i) => frag.appendChild(renderGameCard(g, startIndex + i)));
  grid.appendChild(frag);
}

// ── API fetch ─────────────────────────────────────────────────────────────
async function fetchGames({ reset = false } = {}) {
  if (state.loading) return;
  state.loading = true;

  if (reset) {
    state.page   = 1;
    state.games  = [];
    grid.innerHTML = '';
    renderSkeletons(10);
    emptyState.style.display    = 'none';
    loadMoreWrap.style.display  = 'none';
  }

  loadMoreBtn.disabled = true;

  try {
    const params = new URLSearchParams({
      page:      state.page,
      page_size: 20,
      ordering:  '-rating',
    });
    if (state.searchQuery) params.set('search',  state.searchQuery);
    if (state.activeGenre) params.set('genres',  state.activeGenre);

    const res  = await fetch(`/api/games?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.totalCount = data.count || 0;
    state.hasMore    = !!data.next;

    const newGames = data.results || [];
    const startIdx = state.games.length;
    state.games.push(...newGames);

    // Clear skeletons on first load
    if (reset) grid.innerHTML = '';

    if (state.games.length === 0) {
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
      appendCards(newGames, startIdx);
    }

    // Update section meta
    updateSectionHeader();

    loadMoreWrap.style.display = state.hasMore ? 'block' : 'none';
    loadMoreBtn.disabled       = false;
    state.page++;
  } catch (err) {
    console.error('[fetchGames]', err);
    if (reset) grid.innerHTML = '';
    showToast('⚠️ Failed to load games. Check your API key.');
  } finally {
    state.loading = false;
  }
}

function updateSectionHeader() {
  if (state.searchQuery) {
    sectionLabel.textContent = `Results for "${state.searchQuery}"`;
  } else if (state.activeGenre) {
    const pill = document.querySelector(`.filter-pill[data-genre="${state.activeGenre}"]`);
    sectionLabel.textContent = pill ? pill.textContent.trim() : 'Games';
  } else {
    sectionLabel.textContent = 'Top Rated';
  }
  sectionCount.textContent = state.totalCount ? `${state.totalCount.toLocaleString()} games` : '';
}

// ── Modal ─────────────────────────────────────────────────────────────────
function openModal(game) {
  document.getElementById('modal-img').src   = game.background_image || '';
  document.getElementById('modal-img').alt   = game.name;
  document.getElementById('modal-title').textContent = game.name;

  // Meta badges
  const meta = document.getElementById('modal-meta');
  meta.innerHTML = '';
  if (game.rating) {
    const b = document.createElement('span');
    b.className = 'modal-badge rating';
    b.textContent = `★ ${game.rating.toFixed(1)}`;
    meta.appendChild(b);
  }
  if (game.released) {
    const b = document.createElement('span');
    b.className = 'modal-badge';
    b.textContent = `📅 ${game.released}`;
    meta.appendChild(b);
  }
  if (game.ratings_count) {
    const b = document.createElement('span');
    b.className = 'modal-badge';
    b.textContent = `💬 ${game.ratings_count.toLocaleString()} ratings`;
    meta.appendChild(b);
  }

  // Tags sections
  const renderTags = (containerId, items, emoji = '') => {
    const el = document.getElementById(containerId);
    el.innerHTML = (items || []).length
      ? items.map(t => `<span class="modal-tag">${emoji}${escapeHtml(t)}</span>`).join('')
      : '<span style="color:#4b5563;font-size:0.75rem;">None listed</span>';
  };
  renderTags('modal-genres',    game.genres,    '');
  renderTags('modal-tags',      game.tags,      '');
  renderTags('modal-platforms', game.platforms, '');

  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ── Swipe to close modal ──────────────────────────────────────────────────
let touchStartY = 0;
const panel = document.getElementById('modal-panel');
panel.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
panel.addEventListener('touchend',   (e) => {
  if (e.changedTouches[0].clientY - touchStartY > 60) closeModal();
}, { passive: true });

// ── Filter pills ──────────────────────────────────────────────────────────
filterPills.forEach((pill) => {
  pill.addEventListener('click', () => {
    filterPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    state.activeGenre  = pill.dataset.genre;
    state.searchQuery  = '';
    searchInput.value  = '';
    searchClear.classList.remove('visible');
    fetchGames({ reset: true });
  });
});

// ── Search ────────────────────────────────────────────────────────────────
const doSearch = debounce((val) => {
  state.searchQuery = val.trim();
  state.activeGenre = '';
  filterPills.forEach(p => p.classList.remove('active'));
  document.querySelector('.filter-pill[data-genre=""]').classList.add('active');
  fetchGames({ reset: true });
}, 480);

searchInput.addEventListener('input', (e) => {
  const val = e.target.value;
  searchClear.classList.toggle('visible', val.length > 0);
  doSearch(val);
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.classList.remove('visible');
  state.searchQuery = '';
  fetchGames({ reset: true });
  searchInput.focus();
});

// ── Bottom nav ────────────────────────────────────────────────────────────
navItems.forEach((item) => {
  item.addEventListener('click', () => {
    const tab = item.dataset.tab;
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    state.activeTab = tab;

    if (tab === 'search') {
      searchInput.focus();
    } else if (tab === 'categories') {
      document.getElementById('filters').scrollIntoView({ behavior: 'smooth' });
    } else if (tab === 'home') {
      state.searchQuery = '';
      state.activeGenre = '';
      searchInput.value = '';
      searchClear.classList.remove('visible');
      filterPills.forEach(p => p.classList.remove('active'));
      document.querySelector('.filter-pill[data-genre=""]').classList.add('active');
      fetchGames({ reset: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
});

// ── Load more ─────────────────────────────────────────────────────────────
loadMoreBtn.addEventListener('click', () => fetchGames());

// ── PWA install prompt ────────────────────────────────────────────────────
let deferredPrompt = null;
const installBanner  = document.getElementById('install-banner');
const installAccept  = document.getElementById('install-accept');
const installDismiss = document.getElementById('install-dismiss');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBanner.style.display = 'flex';
});

installAccept.addEventListener('click', async () => {
  installBanner.style.display = 'none';
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') showToast('🎮 GameVault installed!');
    deferredPrompt = null;
  }
});
installDismiss.addEventListener('click', () => { installBanner.style.display = 'none'; });
window.addEventListener('appinstalled', () => { installBanner.style.display = 'none'; });

// ── Service Worker ────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────
fetchGames({ reset: true });
