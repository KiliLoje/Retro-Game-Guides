/* ═══════════════════════════════════════════════════════════════════════
   guide_engine.js  —  Viewer Logic
   Boots on ?game=raId. Exits immediately if ?edit is present.

   URL params (all 1-based for user-facing URLs):
     ?game=2919           load guide for game ID 2919
     ?game=2919&tab=3     open at tab 3
     ?game=2919&tab=3&panel=2  open at tab 3, scroll to panel 2
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);

  // Yield to builder if in edit mode
  if (params.get('edit') !== null) return;

  const raId = parseInt(params.get('game') || '0', 10);

  // ── URL PARAMS (1-based, converted to 0-based on use) ────────────────
  const tabParam   = params.get('tab');
  const panelParam = params.get('panel');
  const startTabNum   = tabParam   ? parseInt(tabParam,   10) : 1;
  const startPanelNum = panelParam ? parseInt(panelParam, 10) : null;

  // ── CONSTANTS ─────────────────────────────────────────────────────────
  const OVERRIDE_THEME_KEY   = 'bdr_user_theme';
  const OVERRIDE_PALETTE_KEY = 'bdr_user_palette';
  const FILTER_REMAINING_KEY = 'bdr_show_remaining';

  // ── PATH HELPER ──────────────────────────────────────────────────────
  function getGamePath(id) {
    const topEnd   = Math.ceil(id / 5000) * 5000, topStart = topEnd - 4999;
    const subEnd   = Math.ceil(id / 200)  * 200,  subStart = subEnd - 199;
    return `games/${topStart}-${topEnd}/${subStart}-${subEnd}/${id}`;
  }

  // ── DOM REFERENCES ───────────────────────────────────────────────────
  const $icon    = document.getElementById('guide-icon');
  const $title   = document.getElementById('guide-title');
  const $meta    = document.getElementById('guide-meta');
  const $tabBar  = document.getElementById('tab-bar');
  const $content = document.getElementById('tab-content');

  if (!$icon || !$title || !$meta || !$tabBar || !$content) {
    console.error('guide_engine: Required DOM elements not found.');
    return;
  }

  // ── MUTABLE STATE ─────────────────────────────────────────────────────
  let allTabs        = [];
  let activeTabIndex = -1;
  let storagePrefix  = raId ? `${raId}_` : '';
  let guideThemeKey  = '';
  let guidePaletteKey = '';
  let allThemes      = {};
  let allPalettes    = {};
  const tabCache     = {};

  // ── STORAGE CONTEXT ──────────────────────────────────────────────────
  const ctx = {
    preview: false,
    save(id, val) {
      try { localStorage.setItem(storagePrefix + id, val ? '1' : '0'); } catch (_) {}
    },
    load(id) {
      try { return localStorage.getItem(storagePrefix + id) === '1'; } catch (_) { return false; }
    }
  };

  // ── BOOT ─────────────────────────────────────────────────────────────
  async function boot() {
    if (!raId) { panic('Missing ?game= parameter in URL.'); return; }

    let config, themes, palettes, index;
    try {
      const GAME_PATH = getGamePath(raId) + '/';
      [config, themes, palettes, index] = await Promise.all([
        fetchJSON(`${GAME_PATH}${raId}_00.json`),
        fetchJSON('./themes.json').catch(() => ({})),
        fetchJSON('./palettes.json').catch(() => ({})),
        fetchJSON('./games_index.json').catch(() => ({ systems: {}, series: {}, themes: [], palettes: [], games: [] })),
      ]);
    } catch (e) {
      panic(`Failed to load guide: ${e.message}`); return;
    }

    // theme/palette/series/altSystems are canonical in games_index.json only
    const indexEntry    = Array.isArray(index.games) ? index.games.find(e => e.raId === raId) : null;
    allThemes           = themes;
    allPalettes         = palettes;
    guideThemeKey       = (index.themes   || [])[indexEntry?.theme]   || '';
    guidePaletteKey     = (index.palettes || [])[indexEntry?.palette] || '';
    if (config.storagePrefix) storagePrefix = config.storagePrefix;

    applyThemePalette(guideThemeKey, guidePaletteKey, themes, palettes);
    applyUserOverride(themes, palettes);

    // Header — display fields from _00.json; series/altSystems decoded from index entry
    $icon.textContent  = config.icon || '🎮';
    $title.textContent = config.primaryName || 'Guide';
    document.title     = `${config.primaryName || 'Guide'} — Game Guide`;
    const altSystemNames = (indexEntry?.altSystems || [])
      .map(id => (index.systems || {})[id])
      .filter(Boolean);
    const seriesName = indexEntry?.series != null
      ? (index.series || {})[indexEntry.series] || null
      : null;
    const metaParts = [
      config.primarySystem,
      ...altSystemNames,
      config.year ? String(config.year) : null,
      seriesName,
    ].filter(Boolean);
    $meta.textContent = metaParts.join(' · ');

    // Subtitle
    $content.innerHTML = '';
    if (config.subtitle) {
      const sub = document.createElement('div');
      sub.id = 'guide-subtitle';
      sub.textContent = config.subtitle;
      $content.appendChild(sub);
    }

    // Storage badge + filter btn
    document.getElementById('storage-badge').style.display = '';
    document.getElementById('filter-btn').style.display = '';

    // Tab bar — tabs now live in _00.json
    allTabs = config.tabs || [];
    if (!allTabs.length) { panic('No tabs defined for this guide.'); return; }

    allTabs.forEach((tab, i) => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn';
      btn.textContent = tab.label;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.addEventListener('click', () => activateTab(i));
      $tabBar.appendChild(btn);
    });

    // Keyboard navigation
    document.addEventListener('keydown', e => {
      if (e.target.matches('input,textarea,select,[contenteditable]')) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = Math.max(0, Math.min(allTabs.length - 1,
        activeTabIndex + (e.key === 'ArrowRight' ? 1 : -1)));
      if (next !== activeTabIndex) activateTab(next);
    });

    // Internal link handler (delegated, 1-based tab/panel → 0-based index)
    document.addEventListener('click', e => {
      const link = e.target.closest('.gr-internal-link');
      if (!link) return;
      const tabNum   = parseInt(link.getAttribute('tab'), 10);    // 1-based
      const panelAttr = link.getAttribute('panel');
      const panelNum  = panelAttr === 'none' ? null : parseInt(panelAttr, 10); // 1-based or null
      const tabIdx    = tabNum - 1;
      if (tabIdx < 0 || tabIdx >= allTabs.length) {
        console.warn('Internal link: tab', tabNum, 'not found');
        return;
      }
      const panelIdx = panelNum !== null ? panelNum - 1 : null;
      // Update URL (keep 1-based for human-readable URLs)
      const url = new URL(window.location);
      url.searchParams.set('tab', tabNum);
      if (panelNum !== null) url.searchParams.set('panel', panelNum);
      else url.searchParams.delete('panel');
      history.replaceState({}, '', url);
      activateTab(tabIdx, panelIdx);
    });

    // Box toggle handler
    document.addEventListener('click', e => {
      const box = e.target.closest('.gr-box');
      if (box) {box.classList.toggle('gr-collapsed');}
    });

    initOverrideSheet(themes, palettes);
    initFilterBtn();
    initClearBtn();

    // Activate initial tab from URL params (1-based → 0-based)
    let startTabIdx = startTabNum - 1;
    if (startTabIdx < 0 || startTabIdx >= allTabs.length) startTabIdx = 0;
    const startPanelIdx = startPanelNum !== null ? startPanelNum - 1 : null;

    setTimeout(async () => {
      await activateTab(startTabIdx, startPanelIdx);
    }, 50);
  }

  // ── TAB ACTIVATION ───────────────────────────────────────────────────
  async function activateTab(index, panelIdx = null) {
    // Same tab — just scroll to panel if specified
    if (index === activeTabIndex) {
      if (panelIdx !== null) scrollToPanel(panelIdx);
      return;
    }
    activeTabIndex = index;

    [...$tabBar.querySelectorAll('.tab-btn')].forEach((btn, i) => {
      const active = i === index;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) btn.scrollIntoView({ inline: 'nearest', behavior: 'smooth' });
    });

    const num = allTabs[index]?.num;
    if (!num) return;

    if (tabCache[num]) {
      mountTab(tabCache[num]);
      if (panelIdx !== null) setTimeout(() => scrollToPanel(panelIdx), 50);
      return;
    }

    mountLoading();
    let tabDef;
    try {
      tabDef = await fetchJSON(`${getGamePath(raId)}/${raId}_${num}.json`);
    } catch (e) {
      mountError(`Could not load ${raId}_${num}.json — ${e.message}`); return;
    }

    const frag = buildTabContent(tabDef);
    tabCache[num] = frag;
    mountTab(frag);

    if (panelIdx !== null && tabDef.panels?.[panelIdx]) {
      setTimeout(() => scrollToPanel(panelIdx), 50);
    }
  }

  // ── SCROLL / EXPAND / COLLAPSE ────────────────────────────────────────
  function scrollToPanel(index) {
    const panels = $content.querySelectorAll('.gr-panel-wrap');
    const panelWrap = panels[index];
    if (!panelWrap) return;

    // Expand if collapsed
    const card = panelWrap.querySelector('.gr-card');
    if (card?.classList.contains('gr-collapsed')) expandPanel(index);

    // Offset accounts for all sticky headers (works in both viewer and editor mode)
    const editorHeader = document.getElementById('editor-header');
    const guideHeader  = document.getElementById('guide-header');
    const tabBar       = document.getElementById('tab-bar');
    const offset = (editorHeader?.offsetHeight || 0) +
                   (guideHeader?.offsetHeight  || 0) +
                   (tabBar?.offsetHeight       || 0) + 8;

    const top = panelWrap.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  function expandPanel(index) {
    const panelWrap = $content.querySelectorAll('.gr-panel-wrap')[index];
    if (!panelWrap) return;
    const card = panelWrap.querySelector('.gr-card');
    if (!card) return;
    card.classList.remove('gr-collapsed');
    ctx.save(colKeyFor(panelWrap, index), true);
  }

  function collapsePanel(index) {
    const panelWrap = $content.querySelectorAll('.gr-panel-wrap')[index];
    if (!panelWrap) return;
    const card = panelWrap.querySelector('.gr-card');
    if (!card) return;
    card.classList.add('gr-collapsed');
    ctx.save(colKeyFor(panelWrap, index), false);
  }

  // Storage key: prefer stable panel ID, fall back to positional index
  function colKeyFor(panelWrap, index) {
    return panelWrap.dataset.panelId
      ? '__c_' + panelWrap.dataset.panelId
      : '__c_idx_' + index;
  }

  // ── TAB CONTENT BUILDERS ─────────────────────────────────────────────
  function buildTabContent(tabDef) {
    const frag   = document.createDocumentFragment();
    const panels = tabDef.panels || [];
    if (!panels.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-tab';
      empty.textContent = 'This tab has no content yet.';
      frag.appendChild(empty);
      return frag;
    }
    panels.forEach(panelDef => {
      try {
        frag.appendChild(GuideRender.panel(panelDef, ctx));
      } catch (e) {
        const err = document.createElement('div');
        err.className = 'error-state';
        err.textContent = `Panel error (${panelDef.panelType || '?'}): ${e.message}`;
        frag.appendChild(err);
      }
    });
    return frag;
  }

  // ── MOUNT HELPERS ────────────────────────────────────────────────────
  function clearContent() {
    [...$content.children].forEach(c => { if (c.id !== 'guide-subtitle') c.remove(); });
  }
  function mountTab(frag) {
    clearContent();
    $content.appendChild(frag.cloneNode(true));
    rebindChecklists();
    rebindPanelToggles();
  }
  function mountLoading() {
    clearContent();
    const d = document.createElement('div');
    d.className = 'loading-state';
    d.innerHTML = 'Loading<span class="loading-dot">.</span><span class="loading-dot">.</span><span class="loading-dot">.</span>';
    $content.appendChild(d);
  }
  function mountError(msg) {
    clearContent();
    const d = document.createElement('div');
    d.className = 'error-state';
    d.textContent = `⚠️ ${msg}`;
    $content.appendChild(d);
  }

  // ── CHECKLIST REBINDING ──────────────────────────────────────────────
  function rebindChecklists() {
    $content.querySelectorAll('.gr-check-row').forEach(tr => {
      const itemId = tr.dataset.itemId;
      if (!itemId) return;
      const checked = ctx.load(itemId);
      tr.classList.toggle('gr-checked', checked);
      const cb = tr.querySelector('.gr-checkbox');
      if (cb) { cb.classList.toggle('gr-checked', checked); cb.textContent = checked ? '✓' : ''; }
      tr.addEventListener('click', (e) => {
        e.stopPropagation();
        const now = tr.classList.toggle('gr-checked');
        if (cb) { cb.classList.toggle('gr-checked', now); cb.textContent = now ? '✓' : ''; }
        ctx.save(itemId, now);
        updateProgress(tr);
      });
    });
  }

  // ── PANEL TOGGLE REBINDING ────────────────────────────────────────────
  function rebindPanelToggles() {
    $content.querySelectorAll('.gr-panel-wrap').forEach((panelWrap, index) => {
      const card   = panelWrap.querySelector('.gr-card');
      const header = panelWrap.querySelector('.gr-card-header');
      if (!card || !header) return;

      // Restore collapse state from storage (panelId-based key, stable across reorders)
      const colKey    = colKeyFor(panelWrap, index);
      const isExpanded = ctx.load(colKey);
      if (!isExpanded) card.classList.add('gr-collapsed');

      header.addEventListener('click', (e) => {
        e.preventDefault();
        if (card.classList.contains('gr-collapsed')) {
          expandPanel(index);
        } else {
          collapsePanel(index);
        }
      });
    });
  }

  function updateProgress(tr) {
    const body  = tr.closest('.gr-card-body');
    if (!body) return;
    const total = body.querySelectorAll('.gr-check-row').length;
    const done  = body.querySelectorAll('.gr-check-row.gr-checked').length;
    const fill  = body.querySelector('.gr-progress-fill');
    const count = body.querySelector('.gr-progress-count');
    if (fill)  fill.style.width = Math.round(done / total * 100) + '%';
    if (count) count.textContent = done;
  }

  // ── THEME / PALETTE ───────────────────────────────────────────────────
  function applyThemePalette(themeKey, palKey, themes, palettes) {
    const theme = themes[themeKey] || {};
    const pal   = palettes[palKey] || {};
    const root  = document.documentElement;
    Object.entries(theme.vars || {}).forEach(([k, v]) => root.style.setProperty(k, v));
    Object.entries(pal.vars   || {}).forEach(([k, v]) => root.style.setProperty(k, v));
    if (theme.fonts) {
      root.style.setProperty('--font-body',    theme.fonts.body    || '');
      root.style.setProperty('--font-display', theme.fonts.display || '');
      root.style.setProperty('--font-mono',    theme.fonts.mono    || '');
      if (theme.fonts.googleFonts) {
        let link = document.getElementById('bdr-fonts');
        if (!link) {
          link = document.createElement('link');
          link.id = 'bdr-fonts'; link.rel = 'stylesheet';
          document.head.prepend(link);
        }
        link.href = theme.fonts.googleFonts;
      }
    }
  }

  function applyUserOverride(themes, palettes) {
    const ot = localStorage.getItem(OVERRIDE_THEME_KEY)   || '';
    const op = localStorage.getItem(OVERRIDE_PALETTE_KEY) || '';
    if (ot || op) {
      applyThemePalette(ot || guideThemeKey, op || guidePaletteKey, themes, palettes);
    }
    updateOverrideIndicator();
  }

  function updateOverrideIndicator() {
    const ot  = localStorage.getItem(OVERRIDE_THEME_KEY)   || '';
    const op  = localStorage.getItem(OVERRIDE_PALETTE_KEY) || '';
    const btn = document.getElementById('display-btn');
    if (btn) btn.classList.toggle('overriding', !!(ot || op));
  }

  // ── FILTER BUTTON ─────────────────────────────────────────────────────
  function initFilterBtn() {
    const btn = document.getElementById('filter-btn');
    if (!btn) return;
    function applyFilter(active) {
      document.body.classList.toggle('show-remaining', active);
      btn.classList.toggle('filter-active', active);
      btn.textContent = active ? 'Show all' : 'Show remaining';
      try { localStorage.setItem(FILTER_REMAINING_KEY, active ? '1' : '0'); } catch (_) {}
    }
    const stored = (() => {
      try { return localStorage.getItem(FILTER_REMAINING_KEY) === '1'; } catch (_) { return false; }
    })();
    applyFilter(stored);
    btn.addEventListener('click', () => applyFilter(!document.body.classList.contains('show-remaining')));
  }

  // ── CLEAR PROGRESS ────────────────────────────────────────────────────
  function initClearBtn() {
    const clearBtn     = document.getElementById('clear-btn');
    const clearCancel  = document.getElementById('clear-cancel');
    const clearConfirm = document.getElementById('clear-confirm');
    const clearBackdrop = document.getElementById('clear-backdrop');
    clearBtn?.addEventListener('click',    showClearConfirm);
    clearCancel?.addEventListener('click', hideClearConfirm);
    clearConfirm?.addEventListener('click', clearProgress);
    clearBackdrop?.addEventListener('click', e => {
      if (e.target === e.currentTarget) hideClearConfirm();
    });
  }

  function showClearConfirm() {
    document.getElementById('clear-backdrop')?.classList.add('open');
  }
  function hideClearConfirm() {
    document.getElementById('clear-backdrop')?.classList.remove('open');
  }

  function clearProgress() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(storagePrefix)) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Rebuild current tab to show cleared state
    if (activeTabIndex >= 0 && allTabs.length > 0) {
      const currentNum = allTabs[activeTabIndex].num;
      delete tabCache[currentNum];
      const prev = activeTabIndex;
      activeTabIndex = -1;
      activateTab(prev);
    }

    // Brief feedback on storage badge
    const badge = document.getElementById('storage-badge');
    if (badge) {
      badge.textContent = '● cleared';
      badge.style.display = 'inline-block';
      setTimeout(() => { badge.style.display = ''; }, 2000);
    }
    hideClearConfirm();
  }

  // ── OVERRIDE SHEET ────────────────────────────────────────────────────
  function initOverrideSheet(themes, palettes) {
    const backdrop  = document.getElementById('do-backdrop');
    const sheet     = document.getElementById('do-sheet');
    const closeBtn  = document.getElementById('do-sheet-close');
    const resetBtn  = document.getElementById('do-reset-btn');
    const openBtn   = document.getElementById('display-btn');
    const themeGrid = document.getElementById('do-theme-grid');
    const palGrid   = document.getElementById('do-palette-grid');
    const currentEl = document.getElementById('do-current');
    const defaultEl = document.getElementById('do-guide-default');

    if (!backdrop || !sheet) return;

    function esc2(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    const gThemeLabel = themes[guideThemeKey]?.label    || guideThemeKey;
    const gPalLabel   = palettes[guidePaletteKey]?.label || guidePaletteKey;
    defaultEl.innerHTML = `Guide default: <strong>${esc2(gThemeLabel)}</strong> + <strong>${esc2(gPalLabel)}</strong>`;

    function getActiveTheme()   { return localStorage.getItem(OVERRIDE_THEME_KEY)   || guideThemeKey; }
    function getActivePalette() { return localStorage.getItem(OVERRIDE_PALETTE_KEY) || guidePaletteKey; }

    function refreshCurrent() {
      const ot = localStorage.getItem(OVERRIDE_THEME_KEY)   || '';
      const op = localStorage.getItem(OVERRIDE_PALETTE_KEY) || '';
      if (!ot && !op) { currentEl.textContent = 'guide default'; return; }
      const tLabel = themes[ot   || guideThemeKey]?.label    || ot   || guideThemeKey;
      const pLabel = palettes[op || guidePaletteKey]?.label  || op   || guidePaletteKey;
      currentEl.textContent = `${tLabel} + ${pLabel}`;
    }

    function refreshActiveCards() {
      const at = getActiveTheme(), ap = getActivePalette();
      themeGrid.querySelectorAll('.do-card').forEach(c => c.classList.toggle('active', c.dataset.key === at));
      palGrid.querySelectorAll('.do-card').forEach(c   => c.classList.toggle('active', c.dataset.key === ap));
    }

    Object.entries(themes).forEach(([key, th]) => {
      const card = document.createElement('div');
      card.className = 'do-card'; card.dataset.key = key;
      card.innerHTML = `<div class="do-card-name">${esc2(th.label)}</div><div class="do-card-desc">${esc2(th.description || '')}</div>`;
      card.addEventListener('click', () => {
        localStorage.setItem(OVERRIDE_THEME_KEY, key);
        applyThemePalette(key, getActivePalette(), themes, palettes);
        updateOverrideIndicator(); refreshCurrent(); refreshActiveCards();
      });
      themeGrid.appendChild(card);
    });

    Object.entries(palettes).forEach(([key, pal]) => {
      const card = document.createElement('div');
      card.className = 'do-card'; card.dataset.key = key;
      const dots = [
        { color: pal.vars['--bg']       || '#888', border: true },
        { color: pal.vars['--emphasis'] || '#888', border: false },
        { color: pal.vars['--positive'] || '#888', border: false },
        { color: pal.vars['--text']     || '#888', border: true },
      ].map(d => `<div class="do-dot" style="background:${d.color};${d.border ? 'border:1px solid rgba(128,128,128,0.3)' : ''}"></div>`).join('');
      card.innerHTML = `<div class="do-card-dots">${dots}</div><div class="do-card-name">${esc2(pal.label)}</div>`;
      card.addEventListener('click', () => {
        localStorage.setItem(OVERRIDE_PALETTE_KEY, key);
        applyThemePalette(getActiveTheme(), key, themes, palettes);
        updateOverrideIndicator(); refreshCurrent(); refreshActiveCards();
      });
      palGrid.appendChild(card);
    });

    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(OVERRIDE_THEME_KEY);
      localStorage.removeItem(OVERRIDE_PALETTE_KEY);
      applyThemePalette(guideThemeKey, guidePaletteKey, themes, palettes);
      updateOverrideIndicator(); refreshCurrent(); refreshActiveCards();
    });

    const openSheet  = () => { refreshCurrent(); refreshActiveCards(); backdrop.classList.add('open'); sheet.classList.add('open'); };
    const closeSheet = () => { backdrop.classList.remove('open'); sheet.classList.remove('open'); };
    openBtn?.addEventListener('click', openSheet);
    closeBtn?.addEventListener('click', closeSheet);
    backdrop.addEventListener('click', closeSheet);
    refreshCurrent(); refreshActiveCards();
  }

  // ── UTILITIES ─────────────────────────────────────────────────────────
  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    return res.json();
  }
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function panic(msg) {
    $content.innerHTML = `<div class="error-state">⚠️ Engine error: ${esc(msg)}</div>`;
  }

  // ── INIT ─────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot().catch(e => panic(e.message)));
  } else {
    boot().catch(e => panic(e.message));
  }

})();
