/* ═══════════════════════════════════════════════════════════════════════
   builder.js  —  Editor Core
   Activates on:
     guide.html?edit           → new guide (or import a WIP ZIP)
     guide.html?edit=<raId>    → load existing guide for editing
     guide.html?edit&import=true → import WIP from sessionStorage

   Exports window.B = { state, uid, esc, fGroup, fInput, fTextarea,
                         openSheet, closeSheet, renderPreview }
   for builder_forms.js, which must load after this file.

   Schema (v2):
     games_index.json entry — browse card only:
       { raId, slug, primaryName, primarySystem, icon, theme, palette }

     _00.json — full guide config + metadata + tab manifest:
       { storagePrefix, subtitle, theme, palette, icon,
         primaryName, primarySystem, altSystems, altNames,
         series, year, author,
         tabs: [{ num, label, type }] }
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('edit') === null) return;

  document.body.classList.add('mode-editor');

  const editParam = params.get('edit');         // '' → new, '2919' → load
  const loadRaId  = editParam ? parseInt(editParam, 10) : null;
  const isImport  = params.get('import') === 'true';

  // Handle WIP import from sessionStorage
  if (isImport) {
    const importData = sessionStorage.getItem('wip-import-data');
    const importName = sessionStorage.getItem('wip-import-name');
    if (importData) {
      // Convert ArrayBuffer back to Blob for importZip function
      const bytes = new Uint8Array(importData.split(',').map(Number));
      const blob = new Blob([bytes], { type: 'application/zip' });
      importZip(new File([blob], importName || 'wip.zip'));
      sessionStorage.removeItem('wip-import-data');
      sessionStorage.removeItem('wip-import-name');
    }
  }

  // ── STATE ─────────────────────────────────────────────────────────────
  const state = {
    meta: {
      raId: '', primaryName: '', systemId: null, altSystemIds: [],
      altNames: '', seriesHubId: null, year: '', icon: '🎮', author: '',
      subtitle: '', theme: 'clean', palette: 'slate', contentTags: [],
    },
    tabs:        [],
    activeTabId: null,
    // CSS definition lookups (from themes.json / palettes.json)
    _themes:     {},
    _palettes:   {},
    _panelTypes: {},
    // Index lookups (from games_index.json)
    _systems:      {},   // { "41": "PlayStation Portable", ... }
    _series:       {},   // { "8495": "Harvest Moon | Story of Seasons", ... }
    _tagsList:     [],   // ["Achievement Guide", "Checklist", "Reference", "Walkthrough"]
    _themesList:   [],   // ["bubbles", "clean", "editorial", "retro", "sharp"]
    _palettesList: [],   // ["ash", "contrast", "dusk", "ember", "midnight", "ocean", "parchment", "slate"]
  };

  let sheetConfirm = null;   // () => boolean
  let sheetCancel  = null;   // () => void — called only when sheet is dismissed without confirming

  // ── UTILITIES ─────────────────────────────────────────────────────────
  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9);
  }
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
                          .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function getGamePath(id) {
    const topEnd = Math.ceil(id / 5000) * 5000, topStart = topEnd - 4999;
    const subEnd = Math.ceil(id / 200)  * 200,  subStart = subEnd - 199;
    return `games/${topStart}-${topEnd}/${subStart}-${subEnd}/${id}`;
  }
  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    return res.json();
  }

  // ── FORM PRIMITIVES (shared with builder_forms.js via window.B) ────────
  function fGroup(label, inputEl, hint) {
    const g = document.createElement('div'); g.className = 'f-group';
    if (label) {
      const l = document.createElement('label'); l.className = 'f-label';
      l.textContent = label; g.appendChild(l);
    }
    g.appendChild(inputEl);
    if (hint) {
      const h = document.createElement('div'); h.className = 'f-hint';
      h.textContent = hint; g.appendChild(h);
    }
    return g;
  }
  function fInput(id, placeholder, value) {
    const i = document.createElement('input');
    i.className = 'f-input'; i.id = id;
    i.placeholder = placeholder || ''; i.value = value || '';
    return i;
  }
  function fTextarea(id, value, placeholder) {
    const t = document.createElement('textarea');
    t.className = 'f-textarea'; t.id = id;
    t.value = value || ''; t.placeholder = placeholder || '';
    return t;
  }

  // ── SHEET SYSTEM ─────────────────────────────────────────────────────
  function openSheet(title, bodyEl, onConfirm, confirmLabel, onCancel) {
    document.getElementById('b-sheet-title').textContent   = title;
    document.getElementById('b-sheet-confirm').textContent = confirmLabel || 'Save';
    const body = document.getElementById('b-sheet-body');
    body.innerHTML = '';
    body.appendChild(bodyEl);
    sheetConfirm = onConfirm;
    sheetCancel  = onCancel || null;
    document.getElementById('b-backdrop').classList.add('open');
    document.getElementById('b-sheet').classList.add('open');
    setTimeout(() => body.querySelector('input,textarea,select')?.focus(), 80);
  }

  // Dismiss without confirming — fires onCancel if set
  function closeSheet() {
    document.getElementById('b-backdrop').classList.remove('open');
    document.getElementById('b-sheet').classList.remove('open');
    sheetConfirm = null;
    const cb = sheetCancel;
    sheetCancel  = null;
    cb?.();
  }

  // Confirm — clears onCancel first so dismissal callback doesn't fire
  function confirmSheet() {
    if (!sheetConfirm?.()) return;
    sheetCancel  = null;
    sheetConfirm = null;
    document.getElementById('b-backdrop').classList.remove('open');
    document.getElementById('b-sheet').classList.remove('open');
  }

  // ── LOAD EXISTING GUIDE (?edit=raId) ──────────────────────────────────
  async function loadExistingGuide(raId) {
    const gamePath = getGamePath(raId) + '/';

    // _00.json = guide content/display; games_index.json = browse/style/filter metadata
    const [config, index] = await Promise.all([
      fetchJSON(`${gamePath}${raId}_00.json`),
      fetchJSON('./games_index.json').catch(() => ({})),
    ]);

    if (!config.tabs?.length) throw new Error('No tabs found in _00.json.');

    const indexEntry = Array.isArray(index.games) ? index.games.find(e => e.raId === raId) : null;

    // Populate lookup tables if boot hasn't done it yet
    if (!state._themesList.length && index.themes)   state._themesList   = index.themes;
    if (!state._palettesList.length && index.palettes) state._palettesList = index.palettes;
    if (!Object.keys(state._systems).length && index.systems) state._systems = index.systems;
    if (!Object.keys(state._series).length  && index.series)  state._series  = index.series;
    if (!state._tagsList.length && index.tags) state._tagsList = index.tags;

    const tabFiles = await Promise.all(
      config.tabs.map(t => fetchJSON(`${gamePath}${raId}_${t.num}.json`))
    );

    state.meta = {
      raId:          String(raId),
      primaryName:   config.primaryName   || '',
      systemId:      indexEntry?.system   ?? null,
      altSystemIds:  indexEntry?.altSystems || [],
      altNames:      (indexEntry?.altNames || []).join(', '),
      seriesHubId:   indexEntry?.series   ?? null,
      year:          String(config.year   || ''),
      icon:          indexEntry?.icon     || config.icon || '🎮',
      author:        config.author        || '',
      subtitle:      config.subtitle      || '',
      theme:         state._themesList[indexEntry?.theme]    || 'clean',
      palette:       state._palettesList[indexEntry?.palette] || 'slate',
      contentTags:   (indexEntry?.tags    || []).map(i => state._tagsList[i]).filter(Boolean),
    };

    state.tabs = tabFiles.map((tabDef, i) => {
      const panels = (tabDef.panels || []).map(panel => {
        if (panel.panelType !== 'checklist') return { ...panel };
        const entryKey = Object.keys(panel).find(k => k.startsWith('entry_'));
        if (!entryKey) return { ...panel };
        const { [entryKey]: entryItems, ...rest } = panel;
        return { ...rest, items: entryItems || [] };
      });
      return { id: uid('tab'), label: tabDef.label || `Tab ${i + 1}`, panels };
    });

    if (state.tabs.length) state.activeTabId = state.tabs[0].id;
  }

  // ── THEME / PALETTE (scoped to guide elements, not :root) ─────────────
  // Applies vars to header + tab bar + content so the dark editor
  // chrome is unaffected.
  function applyThemePalette() {
    const theme = state._themes[state.meta.theme]     || {};
    const pal   = state._palettes[state.meta.palette] || {};
    const targets = [
      document.body, // Add body to targets
      document.getElementById('guide-header'),
      document.getElementById('tab-bar'),
      document.getElementById('tab-content'),
    ].filter(Boolean);
    targets.forEach(el => {
      Object.entries(theme.vars || {}).forEach(([k, v]) => el.style.setProperty(k, v));
      Object.entries(pal.vars   || {}).forEach(([k, v]) => el.style.setProperty(k, v));
      if (theme.fonts) {
        el.style.setProperty('--font-body',    theme.fonts.body    || '');
        el.style.setProperty('--font-display', theme.fonts.display || '');
        el.style.setProperty('--font-mono',    theme.fonts.mono    || '');
      }
    });
    if (theme.fonts?.googleFonts) {
      let link = document.getElementById('bdr-preview-fonts');
      if (!link) {
        link = document.createElement('link');
        link.id = 'bdr-preview-fonts'; link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      if (link.href !== theme.fonts.googleFonts) link.href = theme.fonts.googleFonts;
    }
  }

  // ── RENDER PREVIEW ────────────────────────────────────────────────────
  function renderPreview() {
    const m = state.meta;
    if (!m.primaryName && !m.raId) return;

    document.getElementById('guide-header').style.display  = '';
    document.getElementById('tab-bar').style.display       = '';
    document.getElementById('tab-content').style.display   = '';

    document.getElementById('b-header-name').textContent   = m.primaryName || 'New Guide';

    applyThemePalette();

    // Guide header
    document.getElementById('guide-icon').textContent  = m.icon || '🎮';
    document.getElementById('guide-title').textContent = m.primaryName || 'Guide Title';
    const metaParts = [
      m.primarySystem,
      ...(m.altSystems ? m.altSystems.split(',').map(s => s.trim()).filter(Boolean) : []),
      m.year || null, m.series || null,
    ].filter(Boolean);
    document.getElementById('guide-meta').textContent = metaParts.join(' · ');

    // Tab bar
    const tabbar = document.getElementById('tab-bar');
    tabbar.innerHTML = '';
    state.tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = 'gp-tab' + (tab.id === state.activeTabId ? ' active' : '');
      btn.dataset.tabId = tab.id;
      btn.innerHTML = `<span>${esc(tab.label)}</span><span class="gp-tab-edit" title="Rename">✎</span><span class="gp-tab-del" title="Delete">×</span>`;
      btn.addEventListener('click', e => {
        if (e.target.classList.contains('gp-tab-edit')) {
          window.BForms.openEditTabSheet(tab.id); return;
        }
        if (e.target.classList.contains('gp-tab-del')) {
          if (!confirm(`Delete tab "${tab.label}"?`)) return;
          const i = state.tabs.findIndex(t => t.id === tab.id);
          state.tabs.splice(i, 1);
          if (state.activeTabId === tab.id) state.activeTabId = state.tabs[0]?.id || null;
          renderPreview(); return;
        }
        state.activeTabId = tab.id; renderPreview();
      });
      tabbar.appendChild(btn);
    });
    const addTabBtn = document.createElement('button');
    addTabBtn.className = 'gp-add-tab'; addTabBtn.textContent = '+ Add Tab';
    addTabBtn.addEventListener('click', () => window.BForms.openAddTabSheet());
    tabbar.appendChild(addTabBtn);

    // Content
    const content = document.getElementById('tab-content');
    content.innerHTML = '';
    if (!state.activeTabId && state.tabs.length) state.activeTabId = state.tabs[0].id;
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);

    if (!activeTab) {
      content.innerHTML = '<div class="b-no-tab">Select a tab or add one to get started.</div>';
    } else {
      const previewCtx = { save: () => {}, load: () => false, preview: true };
      activeTab.panels.forEach(panel => {
        const wrap    = document.createElement('div'); wrap.className = 'b-panel-wrap';
        const rendered = GuideRender.panel(panel, previewCtx);
        const overlay = document.createElement('div'); overlay.className = 'b-panel-overlay';
        overlay.innerHTML = `
          <button class="b-ov-btn b-ov-up"  title="Move Up">↑</button>
          <button class="b-ov-btn b-ov-dn"  title="Move Down">↓</button>
          <button class="b-ov-btn"           title="Edit Structure">✎ Structure</button>
          <button class="b-ov-btn b-ov-del" title="Delete">🗑</button>`;
        overlay.querySelector('.b-ov-del').addEventListener('click', () => {
          if (confirm('Delete this panel?')) {
            activeTab.panels = activeTab.panels.filter(p => p.id !== panel.id);
            renderPreview();
          }
        });
        overlay.querySelector('[title="Edit Structure"]').addEventListener('click', () =>
          window.BForms.openEditPanelSheet(activeTab.id, panel.id));
        overlay.querySelector('.b-ov-up').addEventListener('click', () =>
          movePanel(activeTab, panel.id, -1));
        overlay.querySelector('.b-ov-dn').addEventListener('click', () =>
          movePanel(activeTab, panel.id,  1));
        wrap.append(rendered, overlay);

        if (['checklist','table','keyvalue','cards'].includes(panel.panelType)) {
          const rowBar = document.createElement('div');
          rowBar.style.cssText = 'display:flex;gap:8px;padding:6px 0 14px';
          const addRowBtn = document.createElement('button');
          addRowBtn.className = 'b-btn b-btn-primary';
          addRowBtn.style.cssText = 'font-size:11px;padding:5px 12px';
          addRowBtn.textContent = '+ Add Row';
          addRowBtn.addEventListener('click', () =>
            window.BForms.openAddRowSheet(activeTab.id, panel.id));
          rowBar.appendChild(addRowBtn);
          const rowCount = window.BForms.getPanelRows(panel).length;
          if (rowCount) {
            const mgBtn = document.createElement('button');
            mgBtn.className = 'b-btn b-btn-ghost';
            mgBtn.style.cssText = 'font-size:11px;padding:5px 12px';
            mgBtn.textContent = `✎ Edit / Reorder (${rowCount})`;
            mgBtn.addEventListener('click', () =>
              window.BForms.openManageRowsSheet(activeTab.id, panel.id));
            rowBar.appendChild(mgBtn);
          }
          wrap.appendChild(rowBar);
        }
        content.appendChild(wrap);
      });

      const addBtn = document.createElement('button');
      addBtn.className = 'b-add-panel'; addBtn.textContent = '+ Add Panel';
      addBtn.addEventListener('click', () =>
        window.BForms.openAddPanelSheet(activeTab.id));
      content.appendChild(addBtn);
    }

    attachLinkListeners();
  }

  function movePanel(tab, panelId, dir) {
    const i = tab.panels.findIndex(p => p.id === panelId), j = i + dir;
    if (j >= 0 && j < tab.panels.length)
      [tab.panels[i], tab.panels[j]] = [tab.panels[j], tab.panels[i]];
    renderPreview();
  }

  // Internal links are navigable in editor
  function attachLinkListeners() {
    document.querySelectorAll('.gr-internal-link').forEach(link => {
      const clone = link.cloneNode(true);
      link.parentNode.replaceChild(clone, link);
      clone.addEventListener('click', e => {
        e.stopPropagation();
        const tab   = parseInt(clone.getAttribute('tab'), 10);
        const panel = clone.getAttribute('panel');
        let msg = '';

        if (tab > 0 && tab < state.tabs.length + 1) {
          state.activeTabId = state.tabs[tab - 1].id;
        } else {
          msg = '(error : could not find tab)'
        }

        renderPreview();

        if (panel !== "none"){
          let panelIndex = parseInt(panel, 10) - 1;
          msg = scrollToPanel(panelIndex);
          msg = msg == undefined ? '' : msg;
        }
        console.info(
          `Internal link → tab ${tab}${panel !== 'none' ? `, panel ${panel}` : ''} ${msg}`
        );
      });
    });
  }

    // ── SCROLL / EXPAND / COLLAPSE ────────────────────────────────────────
  const $content = document.getElementById('tab-content');

  function scrollToPanel(index) {
    const panels = $content.querySelectorAll('.gr-panel-wrap');
    const panelWrap = panels[index];
    if (!panelWrap) return '(error : could not find panel)';

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
  }

  // ── ZIP / INDEX GENERATION ────────────────────────────────────────────
  function entryKeyFromTitle(title) {
    const first = (title || 'Items').trim().split(/\s+/)[0].replace(/[^\w]/g, '');
    return 'entry_' + (first.charAt(0).toUpperCase() + first.slice(1) || 'Items');
  }

  // Builds the lean games_index entry (browse/filter metadata only — no tab info)
  function buildIndexEntry() {
    const m    = state.meta;
    const raId = parseInt(m.raId);
    const slug = m.primaryName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    const themeIdx   = state._themesList.indexOf(m.theme);
    const paletteIdx = state._palettesList.indexOf(m.palette);

    const entry = {
      raId,
      slug,
      name:    m.primaryName,
      system:  m.systemId,
      icon:    m.icon || '🎮',
      theme:   themeIdx   >= 0 ? themeIdx   : 0,
      palette: paletteIdx >= 0 ? paletteIdx : 0,
    };

    // Optional fields — omit when empty
    const altNames = m.altNames ? m.altNames.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (altNames.length)           entry.altNames    = altNames;
    if (m.altSystemIds?.length)    entry.altSystems  = m.altSystemIds;
    if (m.seriesHubId != null)     entry.series      = m.seriesHubId;

    const tags = (m.contentTags || [])
      .map(t => state._tagsList.indexOf(t))
      .filter(i => i >= 0)
      .sort((a, b) => a - b);
    if (tags.length) entry.tags = tags;

    return { entry, slug, raId };
  }

  // Builds the full _00.json (display metadata + tab manifest only)
  function build00Config() {
    const m    = state.meta;
    const raId = parseInt(m.raId);
    // Derive display strings from canonical IDs
    const primarySystem = state._systems[m.systemId] || '';
    const altSystems    = (m.altSystemIds || []).map(id => state._systems[id]).filter(Boolean);
    const altNames      = m.altNames ? m.altNames.split(',').map(s => s.trim()).filter(Boolean) : [];
    const cfg = {
      storagePrefix: `${raId}_`,
      subtitle:      m.subtitle || `Guide by ${m.author || 'BDR'}`,
      primaryName:   m.primaryName,
      primarySystem,
      icon:          m.icon || '🎮',
      author:        m.author || '',
      tabs:          state.tabs.map((tab, i) => ({
        num:   String(i + 1).padStart(2, '0'),
        label: tab.label,
        type:  'panels',
      })),
    };
    if (altSystems.length) cfg.altSystems = altSystems;
    if (altNames.length)   cfg.altNames   = altNames;
    if (m.year)            cfg.year       = parseInt(m.year);
    return cfg;
  }

  function downloadIndexEntry() {
    const m = state.meta;
    if (!m.raId || isNaN(parseInt(m.raId))) { alert('Set a valid RA Game ID in Game Meta first.'); return; }
    if (!m.primaryName) { alert('Set a game title in Game Meta first.'); return; }
    const { entry, slug, raId } = buildIndexEntry();
    const blob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${raId}_${slug}_games_index_entry.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function generateZip() {
    const m = state.meta;
    if (!m.raId || isNaN(parseInt(m.raId))) { alert('Set a valid RA Game ID before generating.'); return; }
    if (!m.primaryName) { alert('Set a game title before generating.'); return; }
    if (!state.tabs.length) { alert('Add at least one tab before generating.'); return; }
    if (typeof JSZip === 'undefined') { alert('JSZip not loaded. Check your connection and refresh.'); return; }

    const raId     = parseInt(m.raId);
    const gamePath = getGamePath(raId);
    const zip      = new JSZip();
    const folder   = zip.folder(`${raId}_submission`);
    const { slug } = buildIndexEntry();

    // _00.json — full config + metadata + tab manifest
    folder.file(`${gamePath}/${raId}_00.json`, JSON.stringify(build00Config(), null, 2));

    // Tab files
    state.tabs.forEach((tab, i) => {
      const num = String(i + 1).padStart(2, '0');
      const serialisedPanels = tab.panels.map(panel => {
        if (panel.panelType !== 'checklist') return panel;
        const { items, ...rest } = panel;
        rest[entryKeyFromTitle(panel.title)] = items || [];
        return rest;
      });
      folder.file(
        `${gamePath}/${raId}_${num}.json`,
        JSON.stringify({ label: tab.label, panels: serialisedPanels }, null, 2)
      );
    });

    // Lean games_index entry
    const { entry: indexEntry } = buildIndexEntry();
    folder.file('games_index_entry.json', JSON.stringify(indexEntry, null, 2));

    // README
    folder.file('README.txt',
      `BDR Guide Submission — ${m.primaryName}\nRA ID: ${raId}\n\n` +
      `FILES TO ADD\n────────────\n` +
      `1. Merge games_index_entry.json into the root games_index.json array.\n\n` +
      `2. Place all files from the games/ directory into the repo's games/ directory.\n` +
      `   Full path: ${gamePath}/\n\nGenerated by BDR Guide Builder.`
    );

    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${raId}_${slug}_submission.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── IMPORT ZIP ────────────────────────────────────────────────────────
  async function importZip(file) {
    if (typeof JSZip === 'undefined') { alert('JSZip not loaded. Check your connection and refresh.'); return; }
    let zip;
    try { zip = await JSZip.loadAsync(file); }
    catch (e) { alert('Could not read ZIP file: ' + e.message); return; }

    const configFile     = Object.values(zip.files).find(f => !f.dir && /_00\.json$/.test(f.name));
    const indexEntryFile = Object.values(zip.files).find(f => !f.dir && f.name.endsWith('games_index_entry.json'));
    const tabFiles       = Object.values(zip.files)
      .filter(f => !f.dir && /_(\d{2})\.json$/.test(f.name) && !/_00\.json$/.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!configFile)      { alert('No _00.json found in ZIP.');  return; }
    if (!tabFiles.length) { alert('No tab files found in ZIP.'); return; }

    let config, indexEntry;
    try { config = JSON.parse(await configFile.async('string')); }
    catch (e) { alert('Could not parse _00.json: ' + e.message); return; }

    if (indexEntryFile) {
      try { indexEntry = JSON.parse(await indexEntryFile.async('string')); }
      catch (_) { /* non-fatal — fall back to defaults */ }
    }

    const parsedTabs = [];
    for (const tf of tabFiles) {
      try { parsedTabs.push(JSON.parse(await tf.async('string'))); }
      catch (e) { alert('Could not parse ' + tf.name + ': ' + e.message); return; }
    }

    const raId = config.storagePrefix
      ? config.storagePrefix.replace('_', '')
      : String(config.raId || '');

    state.meta = {
      raId,
      primaryName:   config.primaryName   || '',
      systemId:      indexEntry?.system   ?? null,
      altSystemIds:  indexEntry?.altSystems || [],
      altNames:      (indexEntry?.altNames || []).join(', '),
      seriesHubId:   indexEntry?.series   ?? null,
      year:          String(config.year   || ''),
      icon:          indexEntry?.icon     || config.icon || '🎮',
      author:        config.author        || '',
      subtitle:      config.subtitle      || '',
      theme:         state._themesList[indexEntry?.theme]     || 'clean',
      palette:       state._palettesList[indexEntry?.palette] || 'slate',
      contentTags:   (indexEntry?.tags    || []).map(i => state._tagsList[i]).filter(Boolean),
    };

    state.tabs = parsedTabs.map((tabDef, i) => {
      const panels = (tabDef.panels || []).map(panel => {
        if (panel.panelType !== 'checklist') return { ...panel };
        const entryKey = Object.keys(panel).find(k => k.startsWith('entry_'));
        if (!entryKey) return { ...panel };
        const { [entryKey]: entryItems, ...rest } = panel;
        return { ...rest, items: entryItems || [] };
      });
      return { id: uid('tab'), label: tabDef.label || `Tab ${i + 1}`, panels };
    });

    if (state.tabs.length) state.activeTabId = state.tabs[0].id;
    renderPreview();
    alert(`Loaded: ${state.meta.primaryName || 'Guide'} — ${state.tabs.length} tab(s). Review Game Meta to verify all fields.`);
  }

  // ── BOOT ─────────────────────────────────────────────────────────────
  async function boot() {
    // Load builder fonts only in editor mode
    const gFonts = document.createElement('link');
    gFonts.rel  = 'stylesheet';
    gFonts.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap';
    document.head.appendChild(gFonts);

    try {
      const [themes, palettes, panelTypes, index] = await Promise.all([
        fetchJSON('./themes.json').catch(() => ({})),
        fetchJSON('./palettes.json').catch(() => ({})),
        fetchJSON('./panel_types.json').catch(() => ({})),
        fetchJSON('./games_index.json').catch(() => ({})),
      ]);
      state._themes       = themes;
      state._palettes     = palettes;
      state._panelTypes   = panelTypes;
      state._systems      = index.systems      || {};
      state._series       = index.series       || {};
      state._tagsList     = index.tags         || [];
      state._themesList   = index.themes       || [];
      state._palettesList = index.palettes     || [];

      // Apply theme immediately after loading
      applyThemePalette();
    } catch (e) {
      console.warn('builder: Could not load shared data:', e);
    }

    if (loadRaId) {
      try {
        await loadExistingGuide(loadRaId);
        renderPreview();
      } catch (e) {
        alert(`Could not load guide ${loadRaId}: ${e.message}`);
        // Failed to load — open meta sheet so user can correct or start fresh
        document.getElementById('guide-header').style.display = 'none';
        document.getElementById('tab-bar').style.display      = 'none';
        document.getElementById('tab-content').style.display  = 'none';
        window.BForms.openMetaSheet({ onCancel: () => location.href = 'index.html' });
      }
    } else {
      // New guide — hide guide chrome, open meta modal immediately.
      // User must confirm meta before the editor becomes visible.
      document.getElementById('guide-header').style.display = 'none';
      document.getElementById('tab-bar').style.display      = 'none';
      document.getElementById('tab-content').style.display  = 'none';
      window.BForms.openMetaSheet({ onCancel: () => location.href = 'index.html' });
    }

    // Wire header buttons — BForms is guaranteed loaded by DOMContentLoaded
    document.getElementById('b-meta-btn')   ?.addEventListener('click', () => window.BForms.openMetaSheet());
    document.getElementById('edit-meta-btn')?.addEventListener('click', () => window.BForms.openMetaSheet());
    document.getElementById('b-gen-btn')    ?.addEventListener('click', generateZip);
    document.getElementById('b-index-btn')  ?.addEventListener('click', downloadIndexEntry);
    document.getElementById('b-open-btn')   ?.addEventListener('click', () =>
      document.getElementById('b-zip-input')?.click());
    document.getElementById('b-zip-input')?.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (file) {
        await importZip(file);
        window.BForms.openMetaSheet();
      }
      e.target.value = '';
    });

    // Sheet controls
    document.getElementById('b-sheet-close')  ?.addEventListener('click', closeSheet);
    document.getElementById('b-sheet-cancel') ?.addEventListener('click', closeSheet);
    document.getElementById('b-backdrop')     ?.addEventListener('click', closeSheet);
    document.getElementById('b-sheet-confirm')?.addEventListener('click', confirmSheet);
  }

  // ── EXPORT shared interface for builder_forms.js ──────────────────────
  // Set before DOMContentLoaded so builder_forms.js can read it on load.
  window.B = { state, uid, esc, fGroup, fInput, fTextarea, openSheet, closeSheet, confirmSheet, renderPreview };

  // ── INIT ─────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot().catch(console.error));
  } else {
    boot().catch(console.error);
  }

})();
