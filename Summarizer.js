/**
 * summarizer.js - Chapter / Verse / Selection Summarizer
 * - Floating button in bottom-right
 * - Summarizes whole chapters, selected verses, single verse
 * - Extractive summarization (no API key needed)
 * - Verse selection by clicking verses
 */

(function () {
  const STOPWORDS = new Set([
    "a","an","the","and","or","but","if","then","else","when","while","of","at","by","for","with","about","against","between","into","through","during","before","after","above","below","to","from","up","down","in","out","on","off","over","under","again","further","once","here","there","where","why","how","all","any","both","each","few","more","most","other","some","such","no","nor","not","only","own","same","so","than","too","very","can","will","just","don","should","now","is","am","are","was","were","be","been","being","have","has","had","having","do","does","did","doing","i","me","my","myself","we","our","ours","ourselves","you","your","yours","yourself","yourselves","he","him","his","himself","she","her","hers","herself","it","its","itself","they","them","their","theirs","themselves","what","which","who","whom","this","that","that'll","these","those","unto","ye","thou","thee","thy","hath","shalt"
  ]);

  // Config
  const LENGTH_MAP = {
    short: 2,
    medium: 4,
    detailed: 6
  };

  let state = {
    mode: 'chapter', // chapter | selected | single | range
    length: 'medium',
    selectedVerses: new Set(), // verse numbers
    lastResult: null
  };

  // DOM creation
  function init() {
    if (document.getElementById('sum-fab')) return; // already inited

    // FAB
    const fab = document.createElement('button');
    fab.id = 'sum-fab';
    fab.setAttribute('aria-label', 'Summarize this chapter');
    fab.innerHTML = `
      <span class="pulse"></span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 7h8M9 12h8M9 17h5M5 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2Z"/>
        <circle cx="5" cy="7" r="0.5" fill="currentColor"/><circle cx="5" cy="12" r="0.5" fill="currentColor"/><circle cx="5" cy="17" r="0.5" fill="currentColor"/>
      </svg>
    `;
    document.body.appendChild(fab);

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'sum-overlay';
    document.body.appendChild(overlay);

    // Panel
    const panel = document.createElement('div');
    panel.id = 'sum-panel';
    panel.innerHTML = `
      <div class="sum-head">
        <div class="sum-head-left">
          <div class="sum-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l7 4v10l-7 4-7-4V7l7-4Z"/><path d="M12 3v14M5 7l7 4 7-4"/></svg>
            Summarizer
          </div>
          <div class="sum-subtitle" id="sum-subtitle">Chapter overview</div>
        </div>
        <button class="sum-close" id="sum-close" aria-label="Close">
          <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="sum-controls">
        <div class="sum-control-group">
          <div class="sum-control-label">What to summarize</div>
          <div class="sum-options" id="sum-mode-options">
            <button class="sum-opt active" data-mode="chapter">Whole Chapter</button>
            <button class="sum-opt" data-mode="selected">Selected Verses</button>
            <button class="sum-opt" data-mode="single">Single Verse</button>
          </div>
        </div>

        <div class="sum-control-group">
          <div class="sum-control-label">Summary length</div>
          <div class="sum-options" id="sum-length-options">
            <button class="sum-opt" data-length="short">Short</button>
            <button class="sum-opt active" data-length="medium">Medium</button>
            <button class="sum-opt" data-length="detailed">Detailed</button>
          </div>
        </div>

        <div class="sum-actions">
          <button class="sum-primary" id="sum-run">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8Z"/></svg>
            Summarize
          </button>
          <button class="sum-secondary" id="sum-copy" style="display:none">Copy</button>
        </div>
      </div>

      <div class="sum-result-wrap" id="sum-result-wrap">
        <div class="sum-empty" id="sum-empty">
          <div class="icon">✦</div>
          <p>Click verses in the text to select them, then summarize.<br/>Or summarize the entire chapter instantly.</p>
        </div>
        <div class="sum-result" id="sum-result" style="display:none"></div>
      </div>
    `;
    document.body.appendChild(panel);

    // Toast
    const toast = document.createElement('div');
    toast.id = 'sum-toast';
    document.body.appendChild(toast);

    bindEvents();
    enhanceVerses();
    
    // Watch for chapter changes
    const observer = new MutationObserver(() => {
      setTimeout(enhanceVerses, 300);
    });
    document.querySelectorAll('[id^="main-"], .reader-inner').forEach(el => {
      observer.observe(el, { childList: true, subtree: true });
    });

    // keyboard shortcut: S to open
    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        openPanel();
      }
    });
  }

  function bindEvents() {
    const fab = document.getElementById('sum-fab');
    const overlay = document.getElementById('sum-overlay');
    const panel = document.getElementById('sum-panel');
    const closeBtn = document.getElementById('sum-close');
    const runBtn = document.getElementById('sum-run');
    const copyBtn = document.getElementById('sum-copy');

    fab.addEventListener('click', () => {
      if (panel.classList.contains('open')) closePanel();
      else openPanel();
    });
    overlay.addEventListener('click', closePanel);
    closeBtn.addEventListener('click', closePanel);

    // mode switching
    document.getElementById('sum-mode-options').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      document.querySelectorAll('#sum-mode-options .sum-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;
      updateSubtitle();
      refreshButtonState();
    });

    document.getElementById('sum-length-options').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-length]');
      if (!btn) return;
      document.querySelectorAll('#sum-length-options .sum-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.length = btn.dataset.length;
    });

    runBtn.addEventListener('click', runSummarization);
    copyBtn.addEventListener('click', copyResult);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('open')) closePanel();
    });
  }

  function openPanel() {
    document.getElementById('sum-overlay').classList.add('open');
    document.getElementById('sum-panel').classList.add('open');
    refreshButtonState();
    updateSubtitle();
  }

  function closePanel() {
    document.getElementById('sum-overlay').classList.remove('open');
    document.getElementById('sum-panel').classList.remove('open');
  }

  function updateSubtitle() {
    const info = getCurrentChapterInfo();
    const sub = document.getElementById('sum-subtitle');
    if (!info) { sub.textContent = 'Chapter overview'; return; }
    if (state.mode === 'selected') {
      const count = state.selectedVerses.size;
      sub.textContent = count ? `${count} verse${count>1?'s':''} selected · ${info.label}` : `Select verses · ${info.label}`;
    } else if (state.mode === 'single') {
      sub.textContent = `Single verse · ${info.label}`;
    } else {
      sub.textContent = `${info.label} · ${info.verseCount} verses`;
    }
  }

  function refreshButtonState() {
    const runBtn = document.getElementById('sum-run');
    if (state.mode === 'selected' && state.selectedVerses.size === 0) {
      runBtn.disabled = true;
      runBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 5v14M5 12h14"/></svg> Select verses first`;
    } else {
      runBtn.disabled = false;
      runBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8Z"/></svg> Summarize`;
    }
  }

  function enhanceVerses() {
    // Make each verse span clickable
    document.querySelectorAll('.verses-text span').forEach(span => {
      if (span.dataset.enhanced) return;
      const sup = span.querySelector('sup');
      if (!sup) return;
      const num = parseInt(sup.textContent, 10);
      if (isNaN(num)) return;

      span.classList.add('sum-selectable');
      span.dataset.verse = String(num);
      span.dataset.enhanced = '1';
      span.title = 'Click to select verse ' + num;

      if (state.selectedVerses.has(num)) span.classList.add('sum-selected');

      span.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleVerse(num, span);
      });
    });
  }

  function toggleVerse(num, el) {
    if (state.selectedVerses.has(num)) {
      state.selectedVerses.delete(num);
      el.classList.remove('sum-selected');
    } else {
      state.selectedVerses.add(num);
      el.classList.add('sum-selected');
    }
    updateSubtitle();
    refreshButtonState();
    // Auto-switch to selected mode if user selects
    if (state.selectedVerses.size > 0 && state.mode === 'chapter') {
      state.mode = 'selected';
      document.querySelectorAll('#sum-mode-options .sum-opt').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === 'selected');
      });
      updateSubtitle();
    }
    if (state.selectedVerses.size === 1) {
      // hint for single mode
      document.querySelector('[data-mode="single"]')?.classList.remove('active');
    }
    if (state.selectedVerses.size === 0) {
      showToast('Selection cleared');
    }
  }

  function getCurrentChapterInfo() {
    // Try to parse header title like "Genesis 1"
    const header = document.getElementById('headerTitle');
    const mainPane = document.getElementById('main-a') || document.querySelector('[id^="main-"]');
    let label = header ? header.textContent.trim() : '';
    if (!label || label === 'Comparing') {
      // try pane toolbar
      const refBtn = document.querySelector('.pane-ref-btn');
      if (refBtn) label = refBtn.textContent.trim();
    }
    const versesEls = getActiveVerses();
    return {
      label: label || 'Current chapter',
      verseCount: versesEls.length,
      verses: versesEls
    };
  }

  function getActiveVerses() {
    // Prefer visible pane(s)
    let containers = [];
    // check if compare mode
    const isCompare = document.body.classList.contains('compare-mode');
    if (isCompare) {
      containers = Array.from(document.querySelectorAll('[id^="main-"]'));
    } else {
      const mainA = document.getElementById('main-a');
      containers = mainA ? [mainA] : [document];
    }
    
    let verses = [];
    containers.forEach(cont => {
      cont.querySelectorAll('.verses-text span').forEach(span => {
        const sup = span.querySelector('sup');
        if (!sup) return;
        const num = parseInt(sup.textContent, 10);
        const text = span.textContent.replace(/^\s*\d+\s*/, '').trim();
        if (!text) return;
        // avoid duplicates across panes - keep first
        if (!verses.find(v => v.verse === num)) {
          verses.push({ verse: num, text });
        } else if (isCompare) {
          // in compare mode, keep all? We'll keep first for summary
        }
      });
    });
    verses.sort((a,b) => a.verse - b.verse);
    return verses;
  }

  // --- Summarization Logic ---
  function tokenize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
  }

  function scoreSentences(verses) {
    const fullText = verses.map(v => v.text).join(' ');
    const tokens = tokenize(fullText);
    const freq = {};
    tokens.forEach(t => freq[t] = (freq[t]||0)+1);
    const maxFreq = Math.max(...Object.values(freq), 1);

    // Score each verse (for verse-level importance)
    const verseScores = verses.map(v => {
      const words = tokenize(v.text);
      let score = 0;
      words.forEach(w => { score += (freq[w]||0) / maxFreq; });
      // slight boost for length normalized
      if (words.length > 0) score = score / Math.sqrt(words.length);
      // boost if contains proper nouns? simple heuristic: capitalized words in original
      const caps = (v.text.match(/[A-Z][a-z]+/g) || []).length;
      score += caps * 0.2;
      return { verse: v.verse, text: v.text, score };
    });

    // Also sentence scores inside verses
    const sentencePool = [];
    verses.forEach(v => {
      const sentences = v.text.match(/[^.!?]+[.!?]+/g) || [v.text];
      sentences.forEach(s => {
        const words = tokenize(s);
        let sScore = 0;
        words.forEach(w => sScore += (freq[w]||0)/maxFreq);
        if (words.length>0) sScore = sScore / Math.sqrt(words.length);
        sentencePool.push({ sentence: s.trim(), verse: v.verse, score: sScore, sourceText: v.text });
      });
    });

    return { freq, verseScores, sentencePool };
  }

  function extractThemes(freq, topN=6) {
    return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0, topN).map(([w])=>w);
  }

  function summarize(verses) {
    if (verses.length === 0) return null;
    const { freq, verseScores, sentencePool } = scoreSentences(verses);
    const numSentences = LENGTH_MAP[state.length] || 4;

    // Pick top sentences (dedup)
    const topSentences = [...sentencePool].sort((a,b)=>b.score-a.score).slice(0, numSentences * 2);
    // Ensure order by appearance
    topSentences.sort((a,b)=>a.verse - b.verse || 0);
    const seen = new Set();
    const finalSentences = [];
    for (const s of topSentences) {
      if (seen.has(s.sentence)) continue;
      seen.add(s.sentence);
      finalSentences.push(s);
      if (finalSentences.length >= numSentences) break;
    }

    // Key verses = highest scoring verses
    const keyVerses = [...verseScores].sort((a,b)=>b.score-a.score).slice(0, Math.min(5, Math.max(2, Math.ceil(verses.length/5))));

    const themes = extractThemes(freq);

    // Build summary text
    let summaryText = finalSentences.map(s=>s.sentence).join(' ');
    if (!summaryText) summaryText = verses.map(v=>v.text).slice(0, numSentences).join(' ');

    return {
      summaryText,
      sentences: finalSentences,
      keyVerses,
      themes,
      stats: {
        verseCount: verses.length,
        wordCount: verses.reduce((acc,v)=>acc+v.text.split(/\s+/).length,0),
        uniqueThemes: themes.length
      }
    };
  }

  function runSummarization() {
    const allVerses = getActiveVerses();
    if (allVerses.length === 0) {
      showToast('No verses loaded yet');
      return;
    }

    let targetVerses = [];
    if (state.mode === 'chapter') {
      targetVerses = allVerses;
    } else if (state.mode === 'selected') {
      targetVerses = allVerses.filter(v => state.selectedVerses.has(v.verse));
    } else if (state.mode === 'single') {
      // if selected has 1, use that, else use first
      if (state.selectedVerses.size === 1) {
        const n = [...state.selectedVerses][0];
        targetVerses = allVerses.filter(v => v.verse === n);
      } else if (state.selectedVerses.size > 1) {
        const first = Math.min(...state.selectedVerses);
        targetVerses = allVerses.filter(v => v.verse === first);
      } else {
        // no selection -> ask user to click
        showToast('Click a verse to summarize it');
        state.mode = 'selected';
        document.querySelectorAll('#sum-mode-options .sum-opt').forEach(b=>b.classList.toggle('active', b.dataset.mode==='selected'));
        return;
      }
    }

    if (targetVerses.length === 0) {
      showToast('No verses in selection');
      return;
    }

    const result = summarize(targetVerses);
    if (!result) return;
    state.lastResult = { ...result, label: getCurrentChapterInfo().label, mode: state.mode, targetVerses };

    renderResult();
  }

  function renderResult() {
    const wrap = document.getElementById('sum-result-wrap');
    const empty = document.getElementById('sum-empty');
    const resultEl = document.getElementById('sum-result');
    const copyBtn = document.getElementById('sum-copy');
    const r = state.lastResult;

    empty.style.display = 'none';
    resultEl.style.display = 'block';
    copyBtn.style.display = 'inline-flex';

    const modeLabel = r.mode === 'chapter' ? 'Chapter Summary' : r.mode === 'selected' ? `Selected (${r.targetVerses.length} verses)` : `Verse ${r.targetVerses[0]?.verse}`;
    
    resultEl.innerHTML = `
      <div class="sum-chapter-badge">✦ ${escapeHtml(r.label)} · ${escapeHtml(modeLabel)}</div>
      <div class="sum-summary-text"><p>${escapeHtml(r.summaryText)}</p></div>

      <div class="sum-section-title">Key Verses</div>
      <div class="sum-key-verses">
        ${r.keyVerses.map(kv => `
          <div class="sum-verse-card">
            <div class="sum-verse-num">VERSE ${kv.verse}</div>
            <div class="sum-verse-text">${escapeHtml(kv.text)}</div>
          </div>
        `).join('')}
      </div>

      <div class="sum-section-title">Themes</div>
      <div class="sum-themes">
        ${r.themes.map(t => `<span class="sum-theme">${escapeHtml(t)}</span>`).join('')}
      </div>

      <div class="sum-stats">
        <div class="sum-stat"><div class="sum-stat-num">${r.stats.verseCount}</div><div class="sum-stat-label">Verses</div></div>
        <div class="sum-stat"><div class="sum-stat-num">${r.stats.wordCount}</div><div class="sum-stat-label">Words</div></div>
        <div class="sum-stat"><div class="sum-stat-num">${r.stats.uniqueThemes}</div><div class="sum-stat-label">Themes</div></div>
      </div>

      <div style="margin-top:18px; display:flex; gap:8px;">
        <button class="sum-secondary" id="sum-clear-sel">Clear selection</button>
        <button class="sum-secondary" id="sum-expand">Show all verses</button>
      </div>
    `;

    // bind inner buttons
    resultEl.querySelector('#sum-clear-sel')?.addEventListener('click', () => {
      clearSelection();
      showToast('Selection cleared');
    });
    resultEl.querySelector('#sum-expand')?.addEventListener('click', () => {
      expandResult();
    });
  }

  function expandResult() {
    if (!state.lastResult) return;
    const resultEl = document.getElementById('sum-result');
    const all = state.lastResult.targetVerses;
    const list = document.createElement('div');
    list.innerHTML = `
      <div class="sum-section-title" style="margin-top:18px">All in scope</div>
      <div class="sum-key-verses">
        ${all.map(v => `
          <div class="sum-verse-card"><div class="sum-verse-num">VERSE ${v.verse}</div><div class="sum-verse-text">${escapeHtml(v.text)}</div></div>
        `).join('')}
      </div>
    `;
    resultEl.appendChild(list);
  }

  function copyResult() {
    if (!state.lastResult) return;
    const r = state.lastResult;
    const text = `${r.label} - ${r.mode.toUpperCase()} SUMMARY\n\n${r.summaryText}\n\nKEY VERSES:\n${r.keyVerses.map(kv => `v${kv.verse}: ${kv.text}`).join('\n')}\n\nTHEMES: ${r.themes.join(', ')}`;
    navigator.clipboard.writeText(text).then(() => showToast('Summary copied')).catch(() => showToast('Copy failed'));
  }

  function clearSelection() {
    state.selectedVerses.clear();
    document.querySelectorAll('.sum-selected').forEach(el => el.classList.remove('sum-selected'));
    updateSubtitle();
    refreshButtonState();
  }

  function showToast(msg) {
    const toast = document.getElementById('sum-toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // Public API for other scripts
  window.BibleSummarizer = {
    summarizeChapter: () => { state.mode='chapter'; runSummarization(); openPanel(); },
    summarizeSelection: () => { state.mode='selected'; runSummarization(); openPanel(); },
    clear: clearSelection,
    getSelection: () => [...state.selectedVerses],
    getLastResult: () => state.lastResult
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
