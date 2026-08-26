/* bible-extras-versions.js
   Adds 10 additional Bible translations ("kinds") to the reader's version
   dropdowns -- WITHOUT touching index.html.

   Two sources are used:

   1. NEW_VERSIONS -- 5 more translations confirmed live on bible-api.com,
      the same API the reader already uses. These just need an extra
      <option>; the app's own fetch code (loadPane) handles them natively.
      Verified against https://bible-api.com/data (the API's own listing),
      not just its docs page, since a wrong code 404s in the reader.
      NOTE: bible-api.com only has 17 translations total. The app ships 13
      of them already, so these 5 are *all* that remain on this API.

   2. HAO_VERSIONS -- 5 more translations from a second, much larger API
      (bible.helloao.org, 1000+ translations -- the "Free Use Bible API"
      whose SDK docs prompted this). bible-api.com doesn't have these, so
      the app's built-in fetch logic can't be used for them. Because that
      logic lives in index.html's inline script (closure-private, and off
      limits to edit), this file instead:
        - intercepts the version <select> "change" event in the CAPTURE
          phase on `document` -- which always fires before the app's own
          listener on the select itself, regardless of script load order --
          and stops it there for these codes so the app never tries (and
          fails) to fetch them from bible-api.com;
        - fetches and renders the chapter itself, reusing the app's own
          CSS classes (.fade-in, .chapter-heading, .verses-text, etc.) so
          it looks native;
        - does the same capture-phase interception for the prev/next
          chapter buttons while a pane is in this "extended" mode.

   Known limitations of the helloao-sourced translations (native
   bible-api.com ones have none of these):
     - Bookmarks, highlights, the AI tab, Compare tab, and read-aloud all
       read the app's own internal state, which this file can't reach into
       -- they simply won't reflect what's shown while an extended
       translation is open.
     - Switching back to a native translation resumes at whatever chapter
       the pane was on *before* switching to the extended one (the app's
       real position, untouched by design) rather than wherever you
       navigated to while browsing the extended translation.
     - HBOMAS (Hebrew Masoretic) is Old Testament only, by nature of that
       text -- New Testament chapters won't have anything to show.
*/
(function () {
  "use strict";

  // ---- Source 1: native bible-api.com translations ------------------
  var NEW_VERSIONS = [
    ["dra", "DRA — Douay-Rheims American"],
    ["synodal", "Synodal — Russian Synodal Bible (Russian)"],
    ["cherokee", "Cherokee — Cherokee New Testament"],
    ["cuv", "CUV — Chinese Union Version (Chinese)"],
    ["bkr", "BKR — Bible kralická (Czech)"]
  ];

  // ---- Source 2: helloao.org translations (rendered by this file) ---
  var HAO_PREFIX = "hao:";
  var HAO_API = "https://bible.helloao.org/api";
  var HAO_VERSIONS = [
    ["BSB", "BSB (extended) — Berean Standard Bible"],
    ["ARBNAV", "Arabic NAV (extended) — New Arabic Version"],
    ["HINIRV", "Hindi IRV (extended) — Indian Revised Version"],
    ["ben_irv", "Bengali IRV (extended) — Indian Revised Version"],
    ["HBOMAS", "Hebrew Masoretic (extended) — Old Testament only"]
  ];

  // Book display name (matches what the reader shows, e.g. "Psalm", not
  // "Psalms"; "Song of Songs", not "Song of Solomon") -> [USX code, chapters]
  var BOOK_LIST = [
    ["Genesis", "GEN", 50], ["Exodus", "EXO", 40], ["Leviticus", "LEV", 27], ["Numbers", "NUM", 36], ["Deuteronomy", "DEU", 34],
    ["Joshua", "JOS", 24], ["Judges", "JDG", 21], ["Ruth", "RUT", 4], ["1 Samuel", "1SA", 31], ["2 Samuel", "2SA", 24], ["1 Kings", "1KI", 22], ["2 Kings", "2KI", 25], ["1 Chronicles", "1CH", 29], ["2 Chronicles", "2CH", 36], ["Ezra", "EZR", 10], ["Nehemiah", "NEH", 13], ["Esther", "EST", 10],
    ["Job", "JOB", 42], ["Psalm", "PSA", 150], ["Proverbs", "PRO", 31], ["Ecclesiastes", "ECC", 12], ["Song of Songs", "SNG", 8],
    ["Isaiah", "ISA", 66], ["Jeremiah", "JER", 52], ["Lamentations", "LAM", 5], ["Ezekiel", "EZK", 48], ["Daniel", "DAN", 12],
    ["Hosea", "HOS", 14], ["Joel", "JOL", 3], ["Amos", "AMO", 9], ["Obadiah", "OBA", 1], ["Jonah", "JON", 4], ["Micah", "MIC", 7], ["Nahum", "NAM", 3], ["Habakkuk", "HAB", 3], ["Zephaniah", "ZEP", 3], ["Haggai", "HAG", 2], ["Zechariah", "ZEC", 14], ["Malachi", "MAL", 4],
    ["Matthew", "MAT", 28], ["Mark", "MRK", 16], ["Luke", "LUK", 24], ["John", "JHN", 21],
    ["Acts", "ACT", 28],
    ["Romans", "ROM", 16], ["1 Corinthians", "1CO", 16], ["2 Corinthians", "2CO", 13], ["Galatians", "GAL", 6], ["Ephesians", "EPH", 6], ["Philippians", "PHP", 4], ["Colossians", "COL", 4], ["1 Thessalonians", "1TH", 5], ["2 Thessalonians", "2TH", 3], ["1 Timothy", "1TI", 6], ["2 Timothy", "2TI", 4], ["Titus", "TIT", 3], ["Philemon", "PHM", 1],
    ["Hebrews", "HEB", 13], ["James", "JAS", 5], ["1 Peter", "1PE", 5], ["2 Peter", "2PE", 3], ["1 John", "1JN", 5], ["2 John", "2JN", 1], ["3 John", "3JN", 1], ["Jude", "JUD", 1],
    ["Revelation", "REV", 22]
  ];

  var STYLE_ID = "bible-extras-css";
  var STYLE_HREF = "bible-extras.css"; // adjust if you host the CSS elsewhere

  // ---- Small DOM helpers ---------------------------------------------
  function injectStylesheet() {
    if (document.getElementById(STYLE_ID)) return;
    var link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = STYLE_HREF;
    document.head.appendChild(link);
  }

  function hasOption(select, value) {
    return !!select.querySelector('option[value="' + value + '"]');
  }

  function ensureHaoGroup(select) {
    var og = select.querySelector('optgroup[data-hao-group="1"]');
    if (!og) {
      og = document.createElement("optgroup");
      og.label = "Extended (more translations)";
      og.dataset.haoGroup = "1";
      select.appendChild(og);
    }
    return og;
  }

  function addMissingOptions(select) {
    NEW_VERSIONS.forEach(function (pair) {
      var value = pair[0], label = pair[1];
      if (hasOption(select, value)) return;
      var opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      opt.className = "bible-extra-version";
      select.appendChild(opt);
    });
    var og = ensureHaoGroup(select);
    HAO_VERSIONS.forEach(function (pair) {
      var value = HAO_PREFIX + pair[0], label = pair[1];
      if (hasOption(select, value)) return;
      var opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      opt.className = "bible-extra-version";
      og.appendChild(opt);
    });
  }

  function anyOptionsMissing(select) {
    var nativeMissing = NEW_VERSIONS.some(function (p) { return !hasOption(select, p[0]); });
    var haoMissing = HAO_VERSIONS.some(function (p) { return !hasOption(select, HAO_PREFIX + p[0]); });
    return nativeMissing || haoMissing;
  }

  function addBadge(select) {
    if (!select || select.dataset.bibleExtrasBadged) return;
    select.dataset.bibleExtrasBadged = "1";
    var total = NEW_VERSIONS.length + HAO_VERSIONS.length;
    var badge = document.createElement("span");
    badge.className = "bible-extra-badge";
    badge.textContent = "+" + total + " new";
    badge.title = NEW_VERSIONS.concat(HAO_VERSIONS).map(function (p) { return p[1]; }).join(" \u00b7 ");
    select.insertAdjacentElement("afterend", badge);
  }

  // Watch a select for the app overwriting its innerHTML on init, and
  // re-add our options right after -- see file header for why.
  function watch(select, isPrimary) {
    if (!select) return;
    addMissingOptions(select);
    if (isPrimary) addBadge(select);
    var observer = new MutationObserver(function () {
      if (anyOptionsMissing(select)) addMissingOptions(select);
    });
    observer.observe(select, { childList: true });
  }

  // ---- helloao-sourced chapter loading --------------------------------
  var haoState = {}; // paneKey -> {translationId, bookIdx, chapter} | undefined

  function isHaoValue(v) { return typeof v === "string" && v.indexOf(HAO_PREFIX) === 0; }

  function paneRefBtn(paneKey) { return document.querySelector('.pane-ref-btn[data-pane="' + paneKey + '"]'); }
  function paneInner(paneKey) { return document.querySelector('.pane[data-pane="' + paneKey + '"] .reader-inner'); }
  function paneReaderMain(paneKey) { return document.querySelector('.pane[data-pane="' + paneKey + '"] .reader-main'); }

  function findBookIndex(name) {
    for (var i = 0; i < BOOK_LIST.length; i++) { if (BOOK_LIST[i][0] === name) return i; }
    return -1;
  }

  // Reads "BookName ChapterNum" off the pane's own reference button --
  // that's the app's real, currently-displayed position, kept in sync by
  // its own code, so it's a reliable starting point when switching in.
  function currentRef(paneKey) {
    var btn = paneRefBtn(paneKey);
    if (!btn) return null;
    var m = /^(.+)\s(\d+)$/.exec((btn.textContent || "").trim());
    if (!m) return null;
    return { book: m[1], chapter: parseInt(m[2], 10) };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function skeletonHtml() {
    var widths = [92, 88, 95, 80, 90, 85, 78];
    return '<div class="skeleton">' + widths.map(function (w) {
      return '<div class="skel-line" style="width:' + w + '%"></div>';
    }).join("") + '</div>';
  }

  // helloao chapter JSON has chapter.content: an array of items; verse
  // items have {type:"verse", number, content:[...]} where content mixes
  // plain strings with formatting markers ({lineBreak:true}, {noteId:N}) --
  // keep only the strings for plain reading text.
  function extractVerses(data) {
    var content = (data && data.chapter && data.chapter.content) || [];
    var out = [];
    content.forEach(function (item) {
      if (!item || item.type !== "verse") return;
      var text = (item.content || [])
        .filter(function (p) { return typeof p === "string"; })
        .join(" ").replace(/\s+/g, " ").trim();
      out.push({ verse: item.number, text: text });
    });
    return out;
  }

  function renderHaoVerses(paneKey, translationId, book, chapter, verses) {
    var inner = paneInner(paneKey);
    if (!inner) return;
    inner.innerHTML = "";
    if (!verses.length) {
      inner.innerHTML = '<div class="state-msg"><p>No verses returned for this chapter.</p></div>';
      return;
    }
    var cont = document.createElement("div"); cont.className = "fade-in";
    var head = document.createElement("div"); head.className = "chapter-heading";
    head.innerHTML =
      '<div class="left"><div class="eyebrow">' + escapeHtml(translationId) + ' \u00b7 extended, via helloao.org</div>' +
      '<h1>' + escapeHtml(book[0]) + ' <span class="chnum">' + chapter + '</span></h1></div>' +
      '<div class="right"></div>';
    cont.appendChild(head);
    var vEl = document.createElement("div"); vEl.className = "verses-text";
    verses.forEach(function (v) {
      var span = document.createElement("span");
      var sup = document.createElement("sup"); sup.textContent = v.verse;
      span.appendChild(sup);
      span.appendChild(document.createTextNode(v.text + " "));
      vEl.appendChild(span);
    });
    cont.appendChild(vEl);
    inner.appendChild(cont);
    var main = paneReaderMain(paneKey);
    if (main) main.scrollTo({ top: 0, behavior: "instant" });
  }

  function updateHaoHeader(paneKey, book, chapter) {
    var label = book[0] + " " + chapter;
    var refBtn = paneRefBtn(paneKey);
    if (refBtn) refBtn.textContent = label;
    if (paneKey === "a") {
      var headerTitle = document.getElementById("headerTitle");
      var isCompare = document.body.classList.contains("compare-mode");
      if (headerTitle) headerTitle.textContent = isCompare ? "Comparing" : label;
    }
  }

  function updateHaoPager(paneKey, book, chapter) {
    var prevBtn = document.querySelector('.prev-btn[data-pane="' + paneKey + '"]');
    var nextBtn = document.querySelector('.next-btn[data-pane="' + paneKey + '"]');
    var pagerLabel = document.querySelector('.pane[data-pane="' + paneKey + '"] .pager-label');
    var bookIdx = findBookIndex(book[0]);
    if (prevBtn) prevBtn.disabled = (bookIdx === 0 && chapter === 1);
    if (nextBtn) nextBtn.disabled = (bookIdx === BOOK_LIST.length - 1 && chapter === book[2]);
    if (pagerLabel) pagerLabel.textContent = book[0] + " \u00b7 Ch " + chapter + "/" + book[2];
  }

  function loadHaoChapter(paneKey, translationId, bookIdx, chapter) {
    var book = BOOK_LIST[bookIdx];
    var inner = paneInner(paneKey);
    if (!inner) return;
    inner.innerHTML = skeletonHtml();
    var url = HAO_API + "/" + encodeURIComponent(translationId) + "/" + book[1] + "/" + chapter + ".json";
    fetch(url).then(function (res) {
      if (!res.ok) throw new Error("http-" + res.status);
      return res.json();
    }).then(function (data) {
      var verses = extractVerses(data);
      haoState[paneKey] = { translationId: translationId, bookIdx: bookIdx, chapter: chapter };
      renderHaoVerses(paneKey, translationId, book, chapter, verses);
      updateHaoHeader(paneKey, book, chapter);
      updateHaoPager(paneKey, book, chapter);
    }).catch(function (err) {
      inner.innerHTML = '<div class="state-msg"><p>' + escapeHtml(book[0]) + ' ' + chapter +
        ' failed to load from the extended translation (' + escapeHtml(String(err && err.message || err)) + ').</p></div>';
    });
  }

  function navigateHao(paneKey, direction) {
    var st = haoState[paneKey];
    if (!st) return;
    var bookIdx = st.bookIdx, chapter = st.chapter + direction;
    var totalCh = BOOK_LIST[bookIdx][2];
    if (chapter < 1) {
      if (bookIdx === 0) return;
      bookIdx -= 1; chapter = BOOK_LIST[bookIdx][2];
    } else if (chapter > totalCh) {
      if (bookIdx === BOOK_LIST.length - 1) return;
      bookIdx += 1; chapter = 1;
    }
    loadHaoChapter(paneKey, st.translationId, bookIdx, chapter);
  }

  // ---- Capture-phase interception -------------------------------------
  // Fires before the target's own listeners regardless of script order,
  // so it reliably runs ahead of the app's inline-script handlers.
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (!el || (el.id !== "versionSelect" && el.id !== "versionSelectB")) return;
    var paneKey = el.id === "versionSelect" ? "a" : "b";
    var value = el.value;
    if (isHaoValue(value)) {
      e.stopPropagation();
      var translationId = value.slice(HAO_PREFIX.length);
      var ref = currentRef(paneKey) || { book: "Genesis", chapter: 1 };
      var bookIdx = findBookIndex(ref.book);
      if (bookIdx < 0) bookIdx = 0;
      loadHaoChapter(paneKey, translationId, bookIdx, ref.chapter || 1);
    } else {
      // Switching to a native code -- let the app's own handler run;
      // just stop treating this pane as being in extended mode.
      haoState[paneKey] = null;
    }
  }, true);

  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest && e.target.closest(".prev-btn, .next-btn");
    if (!btn) return;
    var paneKey = btn.dataset.pane;
    if (!paneKey || !haoState[paneKey]) return; // native mode -- let the app handle it
    e.stopPropagation();
    navigateHao(paneKey, btn.classList.contains("next-btn") ? 1 : -1);
  }, true);

  // ---- Init -------------------------------------------------------------
  function start() {
    injectStylesheet();
    watch(document.getElementById("versionSelect"), true);
    watch(document.getElementById("versionSelectB"), false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
