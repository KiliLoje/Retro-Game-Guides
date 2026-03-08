/* ═══════════════════════════════════════════════════════════════════════
   builder_forms.js  —  Editor Sheets & Forms
   Depends on builder.js (must load first — exports window.B).

   Exports window.BForms = {
     openMetaSheet, openAddTabSheet, openEditTabSheet,
     openAddPanelSheet, openEditPanelSheet,
     openAddRowSheet, openEditRowSheet, openManageRowsSheet,
     getPanelRows,
   }
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Bail if not in editor mode (builder.js sets this)
  if (!window.B) return;

  const { state, uid, esc, fGroup, fInput, fTextarea, openSheet, closeSheet, renderPreview } = window.B;

  // ── META SHEET ───────────────────────────────────────────────────────
  function openMetaSheet(opts) {
    const onCancel = opts?.onCancel || null;
    const m  = state.meta;
    const el = document.createElement('div');

    // Build system options sorted by name
    const systemOptions = Object.entries(state._systems)
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([id, name]) =>
        `<option value="${id}"${parseInt(id) === m.systemId ? ' selected' : ''}>${esc(name)}</option>`
      ).join('');

    // Build alt-system multi-select (same list)
    const altSystemOptions = Object.entries(state._systems)
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([id, name]) =>
        `<option value="${id}"${(m.altSystemIds || []).includes(parseInt(id)) ? ' selected' : ''}>${esc(name)}</option>`
      ).join('');

    el.innerHTML = `
      <div class="f-group">
        <label class="f-label">RetroAchievements Game ID *</label>
        <input class="f-input" id="mf-raId" type="number" placeholder="e.g. 2919" value="${esc(m.raId)}">
      </div>
      <div class="f-group">
        <label class="f-label">Game Title *</label>
        <input class="f-input" id="mf-name" placeholder="e.g. Harvest Moon: Hero of Leaf Valley" value="${esc(m.primaryName)}">
      </div>
      <div class="f-group">
        <label class="f-label">Alt Names <span style="font-weight:400;text-transform:none">(comma-separated — e.g. Japanese title)</span></label>
        <input class="f-input" id="mf-altnames" placeholder="e.g. Bokujo Monogatari" value="${esc(m.altNames)}">
      </div>
      <div class="f-row">
        <div class="f-group" style="flex:1">
          <label class="f-label">Primary System *</label>
          <select class="f-input" id="mf-sys">
            <option value="">— select —</option>
            ${systemOptions}
          </select>
        </div>
        <div class="f-group" style="flex:0 0 90px">
          <label class="f-label">Year</label>
          <input class="f-input" id="mf-year" type="number" placeholder="2007" value="${esc(m.year)}">
        </div>
      </div>
      <div class="f-group">
        <label class="f-label">Alt Systems <span style="font-weight:400;text-transform:none">(hold Ctrl/Cmd to select multiple)</span></label>
        <select class="f-input" id="mf-altsys" multiple size="4">
          ${altSystemOptions}
        </select>
      </div>
      <div class="f-group">
        <label class="f-label">Series</label>
        <input class="f-input" id="mf-series-search" list="mf-series-list"
          placeholder="Type to search…"
          value="${m.seriesHubId != null ? esc(state._series[m.seriesHubId] || '') : ''}">
        <datalist id="mf-series-list">
          ${Object.entries(state._series)
              .sort(([, a], [, b]) => a.localeCompare(b))
              .map(([id, name]) => `<option value="${esc(name)}" data-id="${id}">`)
              .join('')}
        </datalist>
        <input type="hidden" id="mf-series-id" value="${m.seriesHubId ?? ''}">
        <div class="f-hint">Leave blank if standalone. Hub ID resolves automatically from the series name.</div>
      </div>
      <div class="f-row">
        <div class="f-group" style="flex:1">
          <label class="f-label">Author</label>
          <input class="f-input" id="mf-author" placeholder="Your handle" value="${esc(m.author)}">
        </div>
        <div class="f-group" style="flex:0 0 80px">
          <label class="f-label">Icon</label>
          <input class="f-input" id="mf-icon" placeholder="🎮" value="${esc(m.icon)}" style="text-align:center;font-size:18px">
        </div>
      </div>
      <div class="f-group">
        <label class="f-label">Subtitle <span style="font-weight:400;text-transform:none">(shown in guide viewer, not on browse card)</span></label>
        <input class="f-input" id="mf-sub" placeholder="e.g. Completion tracker — progress saved locally" value="${esc(m.subtitle)}">
      </div>
      <div class="f-group">
        <label class="f-label">Content Tags <span style="font-weight:400;text-transform:none">(for browse filtering)</span></label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
            <input type="checkbox" id="mf-tag-walkthrough" ${m.contentTags?.includes('Walkthrough') ? 'checked' : ''}>
            Walkthrough
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
            <input type="checkbox" id="mf-tag-checklist" ${m.contentTags?.includes('Checklist') ? 'checked' : ''}>
            Checklist
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
            <input type="checkbox" id="mf-tag-reference" ${m.contentTags?.includes('Reference') ? 'checked' : ''}>
            Reference
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
            <input type="checkbox" id="mf-tag-achievement" ${m.contentTags?.includes('Achievement Guide') ? 'checked' : ''}>
            Achievement Guide
          </label>
        </div>
      </div>
      <hr class="f-divider">
      <div class="f-group">
        <label class="f-label">Theme <span style="font-weight:400;text-transform:none">— shape &amp; fonts</span></label>
        <div class="swatch-grid" id="mf-themes"></div>
      </div>
      <div class="f-group" style="margin-top:14px">
        <label class="f-label">Palette <span style="font-weight:400;text-transform:none">— colours</span></label>
        <div class="swatch-grid" id="mf-palettes"></div>
      </div>`;

    // Resolve series hub_id when user picks from datalist
    const seriesSearchEl = el.querySelector('#mf-series-search');
    const seriesIdEl     = el.querySelector('#mf-series-id');
    const seriesRevMap   = Object.fromEntries(
      Object.entries(state._series).map(([id, name]) => [name, parseInt(id)])
    );
    seriesSearchEl.addEventListener('input', () => {
      const hubId = seriesRevMap[seriesSearchEl.value.trim()];
      seriesIdEl.value = hubId != null ? String(hubId) : '';
    });

    // Theme swatches
    const themeGrid = el.querySelector('#mf-themes');
    Object.entries(state._themes).forEach(([key, th]) => {
      const card = document.createElement('div');
      card.className = 'swatch-card' + (m.theme === key ? ' selected' : '');
      card.dataset.key = key;
      card.innerHTML = `<div class="swatch-name">${esc(th.label)}</div><div class="swatch-desc">${esc(th.description || '')}</div>`;
      card.addEventListener('click', () => {
        themeGrid.querySelectorAll('.swatch-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
      themeGrid.appendChild(card);
    });

    // Palette swatches
    const palGrid = el.querySelector('#mf-palettes');
    Object.entries(state._palettes).forEach(([key, pal]) => {
      const card = document.createElement('div');
      card.className = 'swatch-card' + (m.palette === key ? ' selected' : '');
      card.dataset.key = key;
      const dots = [
        [pal.vars?.['--bg'],       true ],
        [pal.vars?.['--emphasis'], false],
        [pal.vars?.['--positive'], false],
        [pal.vars?.['--text'],     true ],
      ].map(([c, b]) =>
        `<div class="swatch-dot" style="background:${c||'#888'};${b?'border:1px solid rgba(128,128,128,0.3)':''}"></div>`
      ).join('');
      card.innerHTML = `<div class="swatch-dot-row">${dots}</div><div class="swatch-name">${esc(pal.label)}</div>`;
      card.addEventListener('click', () => {
        palGrid.querySelectorAll('.swatch-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
      palGrid.appendChild(card);
    });

    openSheet('Game Meta', el, () => {
      const raId = el.querySelector('#mf-raId').value.trim();
      const name = el.querySelector('#mf-name').value.trim();
      if (!raId || isNaN(parseInt(raId))) { alert('Please enter a valid RA Game ID.'); return false; }
      if (!name)                          { alert('Please enter a game title.'); return false; }

      const sysVal = el.querySelector('#mf-sys').value;
      if (!sysVal) { alert('Please select a primary system.'); return false; }

      // Alt systems: all selected options
      const altSysSelect = el.querySelector('#mf-altsys');
      const altSystemIds = [...altSysSelect.selectedOptions]
        .map(o => parseInt(o.value))
        .filter(id => !isNaN(id) && id !== parseInt(sysVal));

      // Series: use resolved hub_id from hidden field
      const seriesIdRaw = el.querySelector('#mf-series-id').value.trim();
      const seriesHubId = seriesIdRaw ? parseInt(seriesIdRaw) : null;

      state.meta.raId          = raId;
      state.meta.primaryName   = name;
      state.meta.systemId      = parseInt(sysVal);
      state.meta.altSystemIds  = altSystemIds;
      state.meta.altNames      = el.querySelector('#mf-altnames').value.trim();
      state.meta.seriesHubId   = !isNaN(seriesHubId) ? seriesHubId : null;
      state.meta.year          = el.querySelector('#mf-year').value.trim();
      state.meta.author        = el.querySelector('#mf-author').value.trim();
      state.meta.icon          = el.querySelector('#mf-icon').value.trim() || '🎮';
      state.meta.subtitle      = el.querySelector('#mf-sub').value.trim();

      const contentTags = [];
      if (el.querySelector('#mf-tag-walkthrough').checked) contentTags.push('Walkthrough');
      if (el.querySelector('#mf-tag-checklist').checked)   contentTags.push('Checklist');
      if (el.querySelector('#mf-tag-reference').checked)   contentTags.push('Reference');
      if (el.querySelector('#mf-tag-achievement').checked) contentTags.push('Achievement Guide');
      state.meta.contentTags = contentTags;

      const selTheme = themeGrid.querySelector('.selected');
      const selPal   = palGrid.querySelector('.selected');
      if (selTheme) state.meta.theme   = selTheme.dataset.key;
      if (selPal)   state.meta.palette = selPal.dataset.key;
      renderPreview();
      return true;
    }, 'Save Meta', onCancel);
  }

  // ── TAB SHEETS ───────────────────────────────────────────────────────
  function openAddTabSheet() {
    const el = document.createElement('div');
    el.appendChild(fGroup('Tab Name *',
      fInput('tf-label', 'e.g. 💰 Sales  or  📋 Basics', ''),
      'You can include an emoji at the start.'));
    openSheet('Add Tab', el, () => {
      const label = el.querySelector('#tf-label').value.trim();
      if (!label) { alert('Enter a tab name.'); return false; }
      const tab = { id: uid('tab'), label, panels: [] };
      state.tabs.push(tab);
      state.activeTabId = tab.id;
      renderPreview();
      return true;
    }, 'Add Tab');
  }

  function openEditTabSheet(tabId) {
    const tab = state.tabs.find(t => t.id === tabId);
    if (!tab) return;
    const el = document.createElement('div');
    el.appendChild(fGroup('Tab Name *', fInput('tf-label', '', tab.label)));
    openSheet('Rename Tab', el, () => {
      const label = el.querySelector('#tf-label').value.trim();
      if (!label) { alert('Enter a tab name.'); return false; }
      tab.label = label;
      renderPreview();
      return true;
    }, 'Save Tab');
  }

  // ── PANEL SHEETS ─────────────────────────────────────────────────────
  function openAddPanelSheet(tabId) {
    let selectedType = null;

    const el = document.createElement('div');
    el.innerHTML = `
      <div class="f-group">
        <label class="f-label">Panel Type</label>
        <div class="type-grid" id="pt-grid"></div>
      </div>
      <div id="pt-form-area"></div>`;

    const grid     = el.querySelector('#pt-grid');
    const formArea = el.querySelector('#pt-form-area');

    const defaultTypes = {
      text:      { label: 'Text / Prose',  icon: '📝', description: 'Freeform markdown content.' },
      keyvalue:  { label: 'Key / Value',   icon: '🗂️', description: 'Two-column reference pairs.' },
      checklist: { label: 'Checklist',     icon: '☑️', description: 'Trackable items with columns.' },
      table:     { label: 'Table',         icon: '📊', description: 'Reference table with headers.' },
      cards:     { label: 'Cards',         icon: '🃏', description: 'Rich card entries.' },
    };
    const types = Object.keys(state._panelTypes).length ? state._panelTypes : defaultTypes;

    Object.entries(types).forEach(([key, pt]) => {
      const card = document.createElement('div');
      card.className = 'type-card';
      card.dataset.type = key;
      card.innerHTML = `<div class="type-card-icon">${pt.icon}</div><div class="type-card-label">${esc(pt.label)}</div><div class="type-card-desc">${esc(pt.description)}</div>`;
      card.addEventListener('click', () => {
        grid.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedType = key;
        formArea.innerHTML = '';
        formArea.appendChild(buildStructureForm(key, null));
      });
      grid.appendChild(card);
    });

    openSheet('Add Panel', el, () => {
      if (!selectedType) { alert('Select a panel type.'); return false; }
      const panel = readStructureForm(formArea, selectedType);
      if (!panel) return false;
      panel.id        = uid('panel');
      panel.panelType = selectedType;
      // Initialise empty data arrays so row management works immediately
      if (selectedType === 'keyvalue')  panel.rows  = panel.rows  || [];
      if (selectedType === 'checklist') panel.items = panel.items || [];
      if (selectedType === 'table')     panel.rows  = panel.rows  || [];
      if (selectedType === 'cards')     panel.cards = panel.cards || [];
      const tab = state.tabs.find(t => t.id === tabId);
      if (tab) { tab.panels.push(panel); renderPreview(); }
      return true;
    }, 'Create Panel →');
  }

  function openEditPanelSheet(tabId, panelId) {
    const tab   = state.tabs.find(t => t.id === tabId);
    const panel = tab?.panels.find(p => p.id === panelId);
    if (!panel) return;
    const formEl = buildStructureForm(panel.panelType, panel);
    openSheet('Edit Panel Structure', formEl, () => {
      const updated = readStructureForm(formEl, panel.panelType);
      if (!updated) return false;
      Object.assign(panel, updated);
      renderPreview();
      return true;
    }, 'Save Changes');
  }

  // ── STRUCTURE FORMS ───────────────────────────────────────────────────
  function buildStructureForm(type, data) {
    const el = document.createElement('div');
    el.dataset.panelType = type;
    const d = data || {};
    switch (type) {
      case 'text':      el.appendChild(buildTextForm(d));      break;
      case 'keyvalue':  el.appendChild(buildKVForm(d));        break;
      case 'checklist': el.appendChild(buildChecklistForm(d)); break;
      case 'table':     el.appendChild(buildTableForm(d));     break;
      case 'cards':     el.appendChild(buildCardsForm(d));     break;
    }
    return el;
  }

  function readStructureForm(formEl, type) {
    const title = formEl.querySelector('#pf-title')?.value.trim();
    if (!title) { alert('Panel title is required.'); return null; }
    const panel   = { title };
    const infobox = formEl.querySelector('#pf-infobox')?.value.trim();
    if (infobox) panel.infobox = infobox;
    switch (type) {
      case 'text':
        panel.content = formEl.querySelector('#pf-content')?.value || '';
        break;
      case 'checklist':
        panel.columns = readColumns(formEl.querySelector('#cl-cols'));
        break;
      case 'table':
        panel.columns = readTableCols(formEl.querySelector('#tbl-cols'));
        break;
      case 'cards':
        panel.cardFields = readCardFields(formEl.querySelector('#cards-fields'));
        break;
    }
    return panel;
  }

  function buildTextForm(d) {
    const el = document.createElement('div');
    el.appendChild(fGroup('Panel Title *', fInput('pf-title', 'e.g. Introduction', d.title)));
    el.appendChild(fGroup('Tip Box (optional)', fInput('pf-infobox', 'Highlighted callout above content', d.infobox)));

    // Markdown toolbar
    const toolbar = document.createElement('div'); toolbar.className = 'md-toolbar';
    [
      ['**B**',        '**',   '**'      ],
      ['*I*',          '*',    '*'       ],
      ['`C`',          '`',    '`'       ],
      ['H3',           '### ', ''        ],
      ['• List',       '- ',   ''        ],
      ['[Link](url)',  '[',    '](url)'   ],
      ['[Tab](N)',     '[',    '](1)'     ],
      ['[Panel](N,M)', '[',   '](1,1)'   ],
    ].forEach(([label, before, after]) => {
      const btn = document.createElement('button');
      btn.className = 'md-btn'; btn.type = 'button'; btn.innerHTML = label;
      btn.addEventListener('click', () => {
        const ta = el.querySelector('#pf-content');
        const s = ta.selectionStart, e2 = ta.selectionEnd;
        const sel = ta.value.slice(s, e2);
        ta.value = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e2);
        ta.focus();
        ta.selectionStart = s + before.length;
        ta.selectionEnd   = s + before.length + sel.length;
      });
      toolbar.appendChild(btn);
    });

    const cg = document.createElement('div'); cg.className = 'f-group';
    const lbl = document.createElement('label'); lbl.className = 'f-label'; lbl.textContent = 'Content *';
    const ta  = fTextarea('pf-content', d.content, 'Markdown supported…');
    cg.append(lbl, toolbar, ta);
    el.appendChild(cg);
    return el;
  }

  function buildKVForm(d) {
    const el = document.createElement('div');
    el.appendChild(fGroup('Panel Title *', fInput('pf-title', 'e.g. Controls', d.title)));
    appendDeferred(el, 'Use Add Row to add key / value pairs after creating the panel.');
    return el;
  }

  function buildChecklistForm(d) {
    const el = document.createElement('div');
    el.appendChild(fGroup('Panel Title *', fInput('pf-title', 'e.g. Crops', d.title)));
    el.appendChild(fGroup('Tip Box (optional)', fInput('pf-infobox', 'e.g. No shipment box — bring items to shops.', d.infobox)));

    const colGroup = document.createElement('div'); colGroup.className = 'f-group';
    const colLbl   = document.createElement('label'); colLbl.className = 'f-label';
    colLbl.textContent = 'Extra Columns';
    const colHint  = document.createElement('div'); colHint.className = 'f-hint';
    colHint.textContent = 'Name + Checkbox are always included. Add extras e.g. Location, Price, Notes.';
    const colList  = document.createElement('div'); colList.className = 'list-section'; colList.id = 'cl-cols';
    colGroup.append(colLbl, colHint, colList);
    (d.columns || []).forEach(c => addColRow(colList, c.label, c.key, c.style));
    const colAdd = document.createElement('button'); colAdd.className = 'list-add'; colAdd.textContent = '+ Add Column';
    colAdd.addEventListener('click', () => addColRow(colList, '', '', 'plain'));
    colGroup.appendChild(colAdd);
    el.appendChild(colGroup);
    appendDeferred(el, 'Use Add Row to add checklist items after creating the panel.');
    return el;
  }

  function buildTableForm(d) {
    const el = document.createElement('div');
    el.appendChild(fGroup('Panel Title *', fInput('pf-title', 'e.g. Weapon Stats', d.title)));

    const colGroup = document.createElement('div'); colGroup.className = 'f-group';
    const colLbl   = document.createElement('label'); colLbl.className = 'f-label';
    colLbl.textContent = 'Column Headers';
    const colHint  = document.createElement('div'); colHint.className = 'f-hint';
    colHint.textContent = 'Define all columns first — e.g. Name, Damage, Speed, Notes.';
    const colList  = document.createElement('div'); colList.className = 'list-section'; colList.id = 'tbl-cols';
    colGroup.append(colLbl, colHint, colList);
    (d.columns || []).forEach(c => addTableCol(colList, typeof c === 'string' ? c : c.label || ''));
    const colAdd = document.createElement('button'); colAdd.className = 'list-add'; colAdd.textContent = '+ Add Column';
    colAdd.addEventListener('click', () => addTableCol(colList, ''));
    colGroup.appendChild(colAdd);
    el.appendChild(colGroup);
    appendDeferred(el, 'Use Add Row to fill in table rows after creating the panel.');
    return el;
  }

  function buildCardsForm(d) {
    const el = document.createElement('div');
    el.appendChild(fGroup('Panel Title *', fInput('pf-title', 'e.g. Villagers', d.title)));

    const cfGroup = document.createElement('div'); cfGroup.className = 'f-group';
    const cfLbl   = document.createElement('label'); cfLbl.className = 'f-label';
    cfLbl.textContent = 'Card Fields';
    const cfHint  = document.createElement('div'); cfHint.className = 'f-hint';
    cfHint.textContent = 'First field becomes the card title.';
    const cfList  = document.createElement('div'); cfList.className = 'list-section'; cfList.id = 'cards-fields';
    cfGroup.append(cfLbl, cfHint, cfList);
    (d.cardFields || []).forEach(f => addCardField(cfList, f.label, f.key));
    const cfAdd = document.createElement('button'); cfAdd.className = 'list-add'; cfAdd.textContent = '+ Add Field';
    cfAdd.addEventListener('click', () => addCardField(cfList, '', ''));
    cfGroup.appendChild(cfAdd);
    el.appendChild(cfGroup);
    appendDeferred(el, 'Use Add Row to fill in cards after creating the panel.');
    return el;
  }

  function appendDeferred(el, msg) {
    const d = document.createElement('div');
    d.className = 'f-hint';
    d.style.cssText = 'padding:10px 12px;background:var(--b-surf2);border:1px solid var(--b-border);border-radius:6px;margin-top:8px';
    d.textContent = msg;
    el.appendChild(d);
  }

  // ── COLUMN / FIELD LIST HELPERS ───────────────────────────────────────
  function addColRow(list, label, key, style) {
    const item = document.createElement('div'); item.className = 'list-item';
    const styleOpts = ['plain','accent','dim'].map(s =>
      `<option value="${s}"${style===s?' selected':''}>${s==='plain'?'Standard':s==='accent'?'Accent':'Dim'}</option>`
    ).join('');
    item.innerHTML = `
      <div class="list-item-fields">
        <div class="f-row">
          <input class="f-input col-label" placeholder="Column label (e.g. Price)" value="${esc(label)}">
          <select class="f-select col-style" style="flex:0 0 110px">${styleOpts}</select>
        </div>
      </div>
      <button class="list-item-del" title="Remove">×</button>`;
    item.querySelector('.list-item-del').addEventListener('click', () => item.remove());
    list.appendChild(item);
  }
  function readColumns(colList) {
    if (!colList) return [];
    return [...colList.querySelectorAll('.list-item')].map(item => {
      const label = item.querySelector('.col-label').value.trim();
      const style = item.querySelector('.col-style').value;
      const key   = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || uid('col');
      return { key, label, style };
    }).filter(c => c.label);
  }

  function addTableCol(list, label) {
    const item = document.createElement('div'); item.className = 'list-item';
    item.innerHTML = `
      <div class="list-item-fields">
        <input class="f-input tbl-col-label" placeholder="Column header" value="${esc(label)}">
      </div>
      <button class="list-item-del" title="Remove">×</button>`;
    item.querySelector('.list-item-del').addEventListener('click', () => item.remove());
    list.appendChild(item);
  }
  function readTableCols(colList) {
    if (!colList) return [];
    return [...colList.querySelectorAll('.tbl-col-label')]
      .map(i => i.value.trim()).filter(Boolean);
  }

  function addCardField(list, label, key) {
    const item = document.createElement('div'); item.className = 'list-item';
    item.innerHTML = `
      <div class="list-item-fields">
        <div class="f-row">
          <input class="f-input cf-label" placeholder="Field label (e.g. Birthday)" value="${esc(label)}">
          <input class="f-input cf-key" placeholder="key (auto)" value="${esc(key)}"
                 style="flex:0 0 110px;font-family:var(--b-mono);font-size:11px">
        </div>
      </div>
      <button class="list-item-del" title="Remove">×</button>`;
    item.querySelector('.list-item-del').addEventListener('click', () => item.remove());
    const lInput = item.querySelector('.cf-label');
    const kInput = item.querySelector('.cf-key');
    lInput.addEventListener('input', () => {
      if (!kInput.dataset.manual)
        kInput.value = lInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    });
    kInput.addEventListener('input', () => { kInput.dataset.manual = '1'; });
    list.appendChild(item);
  }
  function readCardFields(list) {
    if (!list) return [];
    return [...list.querySelectorAll('.list-item')].map(item => {
      const label = item.querySelector('.cf-label').value.trim();
      const key   = item.querySelector('.cf-key').value.trim()
        || label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
        || uid('f');
      return { key, label };
    }).filter(f => f.label);
  }

  // ── ROW DATA ACCESSORS ────────────────────────────────────────────────
  function getPanelRows(panel) {
    if (panel.panelType === 'checklist') return panel.items  || [];
    if (panel.panelType === 'keyvalue')  return panel.rows   || [];
    if (panel.panelType === 'table')     return panel.rows   || [];
    if (panel.panelType === 'cards')     return panel.cards  || [];
    return [];
  }
  function appendRow(panel, row) {
    if      (panel.panelType === 'checklist') { if (!panel.items)  panel.items  = []; panel.items.push(row);  }
    else if (panel.panelType === 'keyvalue')  { if (!panel.rows)   panel.rows   = []; panel.rows.push(row);   }
    else if (panel.panelType === 'table')     { if (!panel.rows)   panel.rows   = []; panel.rows.push(row);   }
    else if (panel.panelType === 'cards')     { if (!panel.cards)  panel.cards  = []; panel.cards.push(row);  }
  }
  function setRow(panel, idx, row)  {
    const a = getPanelRows(panel);
    if (idx >= 0 && idx < a.length) a[idx] = row;
  }
  function deleteRow(panel, idx) { getPanelRows(panel).splice(idx, 1); }
  function moveRow(panel, idx, dir) {
    const arr = getPanelRows(panel), j = idx + dir;
    if (j >= 0 && j < arr.length) [arr[idx], arr[j]] = [arr[j], arr[idx]];
  }
  function getRowLabel(panel, row, idx) {
    if (panel.panelType === 'checklist') return row.name || `Row ${idx + 1}`;
    if (panel.panelType === 'keyvalue')  return row.key ? `${row.key}: ${String(row.value || '').slice(0, 40)}` : `Row ${idx + 1}`;
    if (panel.panelType === 'table')     return Array.isArray(row) ? (row[0] || `Row ${idx + 1}`) : `Row ${idx + 1}`;
    if (panel.panelType === 'cards')     { const f = panel.cardFields?.[0]; return f ? (row[f.key] || `Card ${idx + 1}`) : `Card ${idx + 1}`; }
    return `Row ${idx + 1}`;
  }

  // ── ROW SHEETS ────────────────────────────────────────────────────────
  function openAddRowSheet(tabId, panelId) {
    const panel = findPanel(tabId, panelId);
    if (!panel) return;
    const { el, read } = buildRowForm(panel, null);
    openSheet(`Add Row — ${panel.title}`, el, () => {
      const row = read(); if (!row) return false;
      appendRow(panel, row); renderPreview(); return true;
    }, 'Add Row');
  }

  function openEditRowSheet(tabId, panelId, rowIdx) {
    const panel = findPanel(tabId, panelId);
    if (!panel) return;
    const { el, read } = buildRowForm(panel, getPanelRows(panel)[rowIdx]);
    openSheet(`Edit Row — ${panel.title}`, el, () => {
      const row = read(); if (!row) return false;
      setRow(panel, rowIdx, row); renderPreview(); return true;
    }, 'Save Row');
  }

  function openManageRowsSheet(tabId, panelId) {
    const panel = findPanel(tabId, panelId);
    if (!panel) return;
    const el = document.createElement('div');

    const rebuild = () => {
      el.innerHTML = '';
      const rows = getPanelRows(panel);
      if (!rows.length) {
        const empty = document.createElement('div');
        empty.className = 'f-hint';
        empty.style.cssText = 'text-align:center;padding:24px';
        empty.textContent = 'No rows yet — close and use Add Row.';
        el.appendChild(empty);
        return;
      }
      rows.forEach((row, idx) => {
        const item = document.createElement('div');
        item.className = 'list-item'; item.style.alignItems = 'center';

        const label = document.createElement('div');
        label.style.cssText = 'flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--b-text)';
        label.textContent = getRowLabel(panel, row, idx);

        const mkBtn = (text, cls, title) => {
          const b = document.createElement('button');
          b.className = 'b-ov-btn' + (cls ? ' ' + cls : '');
          b.textContent = text; b.title = title || ''; return b;
        };

        const upBtn  = mkBtn('↑',  '', 'Move up');    upBtn.style.padding  = '4px 7px';
        const dnBtn  = mkBtn('↓',  '', 'Move down');  dnBtn.style.padding  = '4px 7px';
        const editBtn = mkBtn('✎ Edit', '', 'Edit row');
        const delBtn  = mkBtn('🗑',  'b-ov-del', 'Delete row'); delBtn.style.padding = '4px 7px';

        upBtn.addEventListener('click',  () => { moveRow(panel, idx, -1); rebuild(); renderPreview(); });
        dnBtn.addEventListener('click',  () => { moveRow(panel, idx,  1); rebuild(); renderPreview(); });
        editBtn.addEventListener('click', () => {
          closeSheet();
          setTimeout(() => openEditRowSheet(tabId, panelId, idx), 200);
        });
        delBtn.addEventListener('click', () => {
          if (confirm('Delete this row?')) { deleteRow(panel, idx); rebuild(); renderPreview(); }
        });

        item.append(label, upBtn, dnBtn, editBtn, delBtn);
        el.appendChild(item);
      });
    };

    rebuild();
    openSheet(`Manage Rows — ${panel.title}`, el, () => true, 'Done');
  }

  // ── ROW FORM BUILDER ─────────────────────────────────────────────────
  function buildRowForm(panel, existing) {
    const el = document.createElement('div');
    const d  = existing || {};

    if (panel.panelType === 'keyvalue') {
      const keyInp = fInput('row-key',   'Key (e.g. Max HP)',   d.key   || '');
      const valInp = fInput('row-value', 'Value (markdown ok)', d.value !== undefined ? String(d.value) : '');
      el.appendChild(fGroup('Key *',  keyInp));
      el.appendChild(fGroup('Value', valInp));
      return { el, read: () => {
        const key = keyInp.value.trim();
        if (!key) { alert('Key is required.'); return null; }
        return { key, value: valInp.value.trim() };
      }};
    }

    if (panel.panelType === 'checklist') {
      const nameInp = fInput('row-name', 'Item name *', d.name || '');
      el.appendChild(fGroup('Name *', nameInp));
      const colInputs = (panel.columns || []).map(col => {
        const inp = fInput('col-' + col.key, col.label, d[col.key] || '');
        el.appendChild(fGroup(col.label, inp));
        return { key: col.key, inp };
      });
      const noteInp = fInput('row-note', 'Optional sub-note under name', d.note || '');
      el.appendChild(fGroup('Note (optional)', noteInp));
      return { el, read: () => {
        const name = nameInp.value.trim();
        if (!name) { alert('Name is required.'); return null; }
        const entry = { id: d.id || uid('item'), name };
        const note  = noteInp.value.trim();
        if (note) entry.note = note;
        colInputs.forEach(({ key, inp }) => { if (inp.value.trim()) entry[key] = inp.value.trim(); });
        return entry;
      }};
    }

    if (panel.panelType === 'table') {
      const cols   = panel.columns || [];
      const cells  = Array.isArray(existing) ? existing : [];
      const inputs = cols.map((col, i) => {
        const inp = fInput('tbl-' + i, typeof col === 'string' ? col : col.label || '', cells[i] || '');
        el.appendChild(fGroup((typeof col === 'string' ? col : col.label || `Col ${i+1}`) + (i === 0 ? ' *' : ''), inp));
        return inp;
      });
      if (!cols.length) {
        el.appendChild(fGroup('', (() => {
          const d2 = document.createElement('div'); d2.className = 'f-hint';
          d2.textContent = 'No columns defined — edit panel structure first.'; return d2;
        })()));
      }
      return { el, read: () => {
        if (inputs.length && !inputs[0].value.trim()) {
          alert(`${typeof cols[0] === 'string' ? cols[0] : cols[0]?.label || 'First column'} is required.`); return null;
        }
        return inputs.map(i => i.value.trim());
      }};
    }

    if (panel.panelType === 'cards') {
      const fields = panel.cardFields || [];
      const inputs = fields.map((field, i) => {
        const inp = fInput('cf-' + field.key, field.label, d[field.key] || '');
        el.appendChild(fGroup(field.label + (i === 0 ? ' *' : ''), inp));
        return { key: field.key, inp };
      });
      if (!fields.length) {
        el.appendChild(fGroup('', (() => {
          const d2 = document.createElement('div'); d2.className = 'f-hint';
          d2.textContent = 'No card fields defined — edit panel structure first.'; return d2;
        })()));
      }
      return { el, read: () => {
        if (inputs.length && !inputs[0].inp.value.trim()) {
          alert(`${fields[0]?.label || 'First field'} is required.`); return null;
        }
        const card = {};
        inputs.forEach(({ key, inp }) => { if (inp.value.trim()) card[key] = inp.value.trim(); });
        return card;
      }};
    }

    return { el, read: () => ({}) };
  }

  // ── HELPERS ───────────────────────────────────────────────────────────
  function findPanel(tabId, panelId) {
    return state.tabs.find(t => t.id === tabId)?.panels.find(p => p.id === panelId) || null;
  }

  // ── EXPORT ────────────────────────────────────────────────────────────
  window.BForms = {
    openMetaSheet,
    openAddTabSheet, openEditTabSheet,
    openAddPanelSheet, openEditPanelSheet,
    openAddRowSheet, openEditRowSheet, openManageRowsSheet,
    getPanelRows,
  };

})();
