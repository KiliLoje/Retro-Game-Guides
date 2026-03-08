/* ═══════════════════════════════════════════════════════════════════════
   guide_render.js  —  Retro Guide Panel Renderer  v3.0
   Shared by guide_engine.js and builder.js.

   Styles are in guide_render.css — link that in your HTML.

   Usage:
     const ctx = { save: (id,v)=>..., load: (id)=>..., preview: false };
     const el = GuideRender.panel(panelDef, ctx);
     container.appendChild(el);

   Internal links in text content:
     [text](2)      → link to tab 2 (1-based)
     [text](2, 3)   → link to panel 3 on tab 2 (both 1-based)
   The host page is responsible for handling click events on .gr-internal-link.

   Exports: window.GuideRender = { panel, injectStyles, md, uid }
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /** No-op stub — styles are now in guide_render.css. */
  function injectStyles() {}

  // ── UTILITIES ─────────────────────────────────────────────────────────
  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** Minimal markdown → HTML. Input is plain text (not pre-escaped). */
  function md(s, skipEsc=false) {
    if (!s) return '';
    let h = skipEsc ? s : esc(s);
    // Headers
    h = h.replace(/^### (.+)$/gm, '<h3 class="gr-h3">$1</h3>');
    h = h.replace(/^## (.+)$/gm,  '<h3 class="gr-h3">$1</h3>');
    // horizontale rules
    h = h.replace(/^\s*(\*\*\*|---|___)\s*$/gm, '<hr class="gr-hr">');
    h = h.replace(/^\s*(===)\s*$/gm, '<hr class="gr-hr2">');
    // infoboxes ("&gt;" correspond to ">")
    h = h.replace(/^&gt; ?(.*(?:\n&gt; ?.*)*)/gm, (match, content) => {
      const cleaned = content.replace(/^&gt; ?/gm, '');
      const html = md(cleaned, true);
      return `<div class="gr-infobox">${html}</div>`;
    });
    // collapsible box
    h = h.replace(/\[\s*(.+?)\s*\]\{\s*([\s\S]+?)\s*\}/g, (match, header, content) => {
      content = md(content, true)
      return `<div class="gr-box gr-collapsed">
                <div class="gr-box-header">
                  <div class="gr-box-title">${header}</div>
                  <div class="gr-box-toggle">▾</div>
                </div>
                <div class="gr-box-body">${content}</div>
              </div>`;
    });
    // Bold / italic
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*(.+?)\*/g,     '<em>$1</em>');
    // Inline code
    h = h.replace(/`(.+?)`/g, '<code class="gr-code">$1</code>');
    // Internal links — must run before external link regex.
    // Tab + panel: [text](tab, panel)  — both 1-based.
    h = h.replace(
      /\[(.+?)\]\(\s*(\d+)\s*,\s*(\d+)\s*\)/g,
      '<span class="gr-internal-link" tab="$2" panel="$3">$1</span>'
    );
    // Tab only: [text](tab)  — 1-based.
    h = h.replace(
      /\[(.+?)\]\(\s*(\d+)\s*\)/g,
      '<span class="gr-internal-link" tab="$2" panel="none">$1</span>'
    );
    // External links
    h = h.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="gr-link" target="_blank" rel="noopener">$1</a>');
    // Unordered lists (collect consecutive li items)
    h = h.replace(/((?:^- .+$\n?)+)/gm, (block) => {
      const items = block.trim().split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('');
      return `<ul class="gr-ul">${items}</ul>`;
    });
    // Paragraphs — split on blank lines, skip block elements
    const blocks = h.split(/\n\n+/);
    h = blocks.map(b => {
      b = b.trim();
      if (!b) return '';
      if (/^<(h3|ul|ol|hr|div|blockquote)/.test(b)) return b;
      return `<p class="gr-p">${b.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    // removing <br> around <hr>
    h = h.replace(/<br>\s*(<hr class="gr-hr2?">)\s*<br>/g, '$1')
     .replace(/<br>\s*(<hr class="gr-hr2?">)/g, '$1')
     .replace(/(<hr class="gr-hr2?">)\s*<br>/g, '$1');

    return h;
  }

  /** Collision-resistant ID for new items. */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9);
  }

  // ── PANEL ENTRY POINT ─────────────────────────────────────────────────
  function panel(def, ctx) {
    ctx = Object.assign({ save: () => {}, load: () => false, preview: true }, ctx);

    const wrap = document.createElement('div');
    wrap.className = 'gr-panel-wrap';
    if (def.id) wrap.dataset.panelId = def.id;

    const card = document.createElement('div');
    card.className = 'gr-card';

    const header = document.createElement('div');
    header.className = 'gr-card-header';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'gr-card-title';
    titleSpan.textContent = def.title || '(Untitled Panel)';
    const toggle = document.createElement('span');
    toggle.className = 'gr-card-toggle';
    toggle.textContent = '▾';
    header.append(titleSpan, toggle);

    // Collapse state: default collapsed. Persist per panel id.
    const colKey = def.id ? '__c_' + def.id : null;
    const isExpanded = colKey ? ctx.load(colKey) : false;
    if (!isExpanded) card.classList.add('gr-collapsed');

    const body = document.createElement('div');
    body.className = 'gr-card-body';
    try {
      body.appendChild(renderContent(def, ctx));
    } catch (e) {
      body.innerHTML = `<div style="color:#c04040;padding:8px;font-size:12px">⚠️ Render error: ${esc(e.message)}</div>`;
    }

    card.append(header, body);
    
    // Add click handler for collapse/expand
    header.addEventListener('click', () => {
      const nowCollapsed = card.classList.toggle('gr-collapsed');
      if (colKey) ctx.save(colKey, !nowCollapsed);
    });
    
    wrap.appendChild(card);
    return wrap;
  }

  // ── CONTENT DISPATCH ─────────────────────────────────────────────────
  function renderContent(def, ctx) {
    switch (def.panelType) {
      case 'text':      return renderText(def);
      case 'keyvalue':  return renderKeyValue(def);
      case 'checklist': return renderChecklist(def, ctx);
      case 'table':     return renderTable(def);
      case 'cards':     return renderCards(def);
      default: {
        const d = document.createElement('div');
        d.style.cssText = 'padding:8px;font-size:12px;color:var(--textMuted)';
        d.textContent = 'Unknown panel type: ' + (def.panelType || '(none)');
        return d;
      }
    }
  }

  // ── TEXT ──────────────────────────────────────────────────────────────
  function renderText(def) {
    const wrap = document.createElement('div');
    if (def.infobox) {
      const ib = document.createElement('div');
      ib.className = 'gr-infobox';
      ib.innerHTML = md(def.infobox);
      wrap.appendChild(ib);
    }
    const content = document.createElement('div');
    content.className = 'gr-text';
    content.innerHTML = md(def.content || '');
    wrap.appendChild(content);
    return wrap;
  }

  // ── KEY-VALUE ─────────────────────────────────────────────────────────
  function renderKeyValue(def) {
    const rows = def.rows || [];
    const tw = document.createElement('div');
    tw.className = 'gr-table-wrap';
    const table = document.createElement('table');
    table.className = 'gr-kv-table';
    rows.forEach(row => {
      const tr = document.createElement('tr');
      const k = document.createElement('td');
      k.className = 'gr-kv-key';
      k.textContent = row.key || '';
      const v = document.createElement('td');
      v.className = 'gr-kv-val';
      v.innerHTML = md(String(row.value ?? ''));
      tr.append(k, v);
      table.appendChild(tr);
    });
    tw.appendChild(table);
    return tw;
  }

  // ── CHECKLIST ─────────────────────────────────────────────────────────
  function renderChecklist(def, ctx) {
    const entryKey = Object.keys(def).find(k => k.startsWith('entry_'));
    const items    = (entryKey ? def[entryKey] : def.items) || [];
    const columns  = def.columns || [];
    const wrap     = document.createElement('div');

    if (def.infobox) {
      const ib = document.createElement('div');
      ib.className = 'gr-infobox';
      ib.innerHTML = md(def.infobox);
      wrap.appendChild(ib);
    }

    // Progress bar (live mode only)
    let progressWrap = null;
    if (!ctx.preview && items.length) {
      const total = items.length;
      const done  = items.filter(it => ctx.load(it.id)).length;
      const pct   = Math.round(done / total * 100);
      progressWrap = document.createElement('div');
      progressWrap.className = 'gr-progress-wrap';
      progressWrap.innerHTML = `
        <div class="gr-progress-bar"><div class="gr-progress-fill" style="width:${pct}%"></div></div>
        <div class="gr-progress-label"><span class="gr-progress-count">${done}</span>&thinsp;/&thinsp;${total}</div>`;
      wrap.appendChild(progressWrap);
    }

    const tw = document.createElement('div');
    tw.className = 'gr-table-wrap';
    const table = document.createElement('table');
    table.className = 'gr-check-table';

    // Header row
    const thead = document.createElement('thead');
    const htr   = document.createElement('tr');
    const cbTh  = document.createElement('th'); cbTh.style.width = '36px';
    const numTh = document.createElement('th'); numTh.style.width = '36px'; numTh.textContent = '#';
    htr.append(cbTh, numTh);
    columns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.label || '';
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);

    // Rows
    const tbody = document.createElement('tbody');
    items.forEach((item, index) => {
      const checked = ctx.load(item.id);
      const tr = document.createElement('tr');
      tr.className = 'gr-check-row' + (checked ? ' gr-checked' : '');
      tr.dataset.itemId = item.id;

      const cbTd = document.createElement('td');
      cbTd.className = 'gr-cb-col';
      const cb = document.createElement('span');
      cb.className = 'gr-checkbox' + (checked ? ' gr-checked' : '');
      if (checked) cb.textContent = '✓';
      cbTd.appendChild(cb);
      tr.appendChild(cbTd);

      const numTd = document.createElement('td');
      numTd.className = 'gr-check-num';
      numTd.textContent = (index + 1).toString();
      tr.appendChild(numTd);

      columns.forEach(col => {
        const td = document.createElement('td');
        td.className = 'gr-check-cell ' + (col.style === 'accent' ? 'gr-accent' : col.style === 'dim' ? 'gr-dim' : '');
        td.textContent = item[col.key] || '';
        if (item.note && col.key === columns[0]?.key) {
          const note = document.createElement('div');
          note.className = 'gr-check-note';
          note.textContent = item.note;
          td.appendChild(note);
        }
        tr.appendChild(td);
      });

      tr.addEventListener('click', e => {
        e.stopPropagation();
        const now = tr.classList.toggle('gr-checked');
        cb.classList.toggle('gr-checked', now);
        cb.textContent = now ? '✓' : '';
        ctx.save(item.id, now);
        if (progressWrap) {
          const total = items.length;
          const done  = items.filter(it => ctx.load(it.id)).length;
          const fill  = progressWrap.querySelector('.gr-progress-fill');
          const count = progressWrap.querySelector('.gr-progress-count');
          if (fill)  fill.style.width = Math.round(done / total * 100) + '%';
          if (count) count.textContent = done;
        }
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tw.appendChild(table);
    wrap.appendChild(tw);
    return wrap;
  }

  // ── TABLE ─────────────────────────────────────────────────────────────
  function renderTable(def) {
    const columns = def.columns || [];
    const rows    = def.rows    || [];
    const tw = document.createElement('div');
    tw.className = 'gr-table-wrap';
    const table = document.createElement('table');

    if (columns.length) {
      const thead = document.createElement('thead');
      const htr   = document.createElement('tr');
      columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = typeof col === 'string' ? col : (col.label || col.key || '');
        htr.appendChild(th);
      });
      thead.appendChild(htr);
      table.appendChild(thead);
    }

    const tbody = document.createElement('tbody');
    rows.forEach(row => {
      const tr    = document.createElement('tr');
      const cells = Array.isArray(row)
        ? row
        : columns.map(c => row[typeof c === 'string' ? c : (c.key || c.label || '')] ?? '');
      cells.forEach(cell => {
        const td = document.createElement('td');
        td.innerHTML = md(String(cell ?? ''));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tw.appendChild(table);
    return tw;
  }

  // ── CARDS ─────────────────────────────────────────────────────────────
  function renderCards(def) {
    const cardFields = def.cardFields || [];
    const cards      = def.cards      || [];
    const wrap = document.createElement('div');
    wrap.className = 'gr-cards';

    cards.forEach(card => {
      const el = document.createElement('div');
      el.className = 'gr-card-item';
      cardFields.forEach((field, idx) => {
        const val = card[field.key];
        if (!val && val !== 0) return;
        if (idx === 0) {
          const name = document.createElement('div');
          name.className = 'gr-card-name';
          name.textContent = String(val);
          el.appendChild(name);
        } else {
          const row = document.createElement('div');
          row.className = 'gr-card-row';
          const lbl = document.createElement('span');
          lbl.className = 'gr-card-label';
          lbl.textContent = (field.label || field.key) + ': ';
          const valSpan = document.createElement('span');
          valSpan.className = 'gr-card-value';
          valSpan.innerHTML = md(String(val));
          row.append(lbl, valSpan);
          el.appendChild(row);
        }
      });
      wrap.appendChild(el);
    });

    return wrap;
  }

  // ── EXPORTS ───────────────────────────────────────────────────────────
  global.GuideRender = { panel, injectStyles, md, uid };

})(window);
