'use strict';

/* ============================================================
   StoryEven — Core Application
   ============================================================
   Features:
   - Parse markdown headings (# ## ### …) from pasted text
   - Count words in each section between headings
   - Visualise sections on a proportional SVG timeline
     · Circles labelled with heading level (H1/H2/H3…)
     · Coloured segments proportional to word counts
     · 🔥 ideal / ✕ too long / ✕ too short quality indicators
     · First-sentence snippet under each marker for quick context
   - Section detail cards with word count + content preview
   - Full document renderer with:
     · Existing headings styled by level
     · ✦ insertion markers showing where to split long sections
     · First sentence of each new chunk shown as context
     · Auto-split for documents with no headings at all
   ============================================================ */

// ── Constants ──────────────────────────────────────────────
const TARGET_WORDS = 250;   // ideal words per section
const MIN_OK       = 150;   // below this → too short
const MAX_OK       = 350;   // above this → too long

const COLOR_GOOD  = '#1e7e1e';
const COLOR_LONG  = '#c0392b';
const COLOR_SHORT = '#d35400';
const COLOR_INTRO = '#888';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ── Markdown Parser ────────────────────────────────────────
/**
 * Parse text into sections. Each section may have a markdown heading
 * (e.g. "## My Section") and a body of paragraph text.
 *
 * @param  {string} text
 * @returns {{ heading: { level: number, text: string } | null, content: string }[]}
 */
function parseMarkdown(text) {
  const lines = text.split('\n');
  const sections = [];

  let currentHeading = null;
  let currentLines   = [];

  function flush() {
    const content = currentLines.join('\n').trim();
    if (content || currentHeading !== null) {
      sections.push({ heading: currentHeading, content });
    }
  }

  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      flush();
      currentHeading = { level: m[1].length, text: m[2].trim() };
      currentLines   = [];
    } else {
      currentLines.push(line);
    }
  }

  flush();
  return sections;
}

// ── Word Counting & Quality ────────────────────────────────
function countWords(str) {
  if (!str.trim()) return 0;
  return str.trim().split(/\s+/).length;
}

/**
 * @returns {'good'|'long'|'short'|'intro'}
 */
function getQuality(wordCount, isIntro) {
  if (isIntro) return 'intro';
  if (wordCount >= MIN_OK && wordCount <= MAX_OK) return 'good';
  if (wordCount > MAX_OK) return 'long';
  return 'short';
}

// ── Build Processed Sections ───────────────────────────────
function buildSections(text) {
  const raw = parseMarkdown(text);

  return raw
    .map(s => {
      const wordCount = countWords(s.content);
      const isIntro   = s.heading === null;
      return {
        heading:   s.heading,
        content:   s.content,
        wordCount,
        quality:   getQuality(wordCount, isIntro),
        isIntro,
      };
    })
    .filter(s => s.heading !== null || s.wordCount > 0);
}

// ── Stats ──────────────────────────────────────────────────
function computeStats(sections) {
  const totalWords     = sections.reduce((n, s) => n + s.wordCount, 0);
  const headedSections = sections.filter(s => !s.isIntro);
  const goodCount      = headedSections.filter(s => s.quality === 'good').length;
  const score          = headedSections.length > 0
    ? Math.round((goodCount / headedSections.length) * 100)
    : null;

  return { totalWords, headedCount: headedSections.length, totalCount: sections.length, score };
}

// ── SVG Helpers ────────────────────────────────────────────
function svgEl(tag, attrs, text) {
  const e = document.createElementNS(SVG_NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text != null) e.textContent = String(text);
  return e;
}

// ── Text Utilities ─────────────────────────────────────────
/**
 * Return the first sentence of text, capped at maxChars.
 * Falls back to first N words if no sentence break is found.
 */
function firstSentenceSnippet(text, maxChars) {
  const t = text.trim().replace(/\n/g, ' ');
  const m = t.match(/^.+?[.!?]["'»]?\s/);
  const sentence = m ? m[0].trim() : t.split(/\s+/).slice(0, 9).join(' ');
  return sentence.length > maxChars ? sentence.slice(0, maxChars - 1) + '…' : sentence;
}

/**
 * Find the best word-index split near targetIdx — prefers a sentence boundary
 * (ends with . ! ?) within ±25 words of the target.
 */
function findSplitIndex(words, targetIdx) {
  for (let i = targetIdx; i < Math.min(targetIdx + 25, words.length - 1); i++) {
    if (/[.!?]["'»]?$/.test(words[i])) return i + 1;
  }
  for (let i = targetIdx - 1; i >= Math.max(targetIdx - 25, 0); i--) {
    if (/[.!?]["'»]?$/.test(words[i])) return i + 1;
  }
  return targetIdx;
}

/**
 * Recursively split text into chunks where each chunk is ≤ MAX_OK words,
 * breaking preferentially at sentence boundaries near TARGET_WORDS.
 */
function chunkText(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= MAX_OK) return [words.join(' ')];

  const splitAt = findSplitIndex(words, TARGET_WORDS);
  const head = words.slice(0, splitAt).join(' ');
  const tail = words.slice(splitAt).join(' ');
  return [head, ...chunkText(tail)];
}

/** Escape HTML special chars for safe innerHTML insertion. */
function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Append <p> elements from a block of text to container.
 * Splits on double newlines; single newlines within a block become spaces.
 */
function appendParas(container, text, extraClass = '') {
  const blocks = text.split(/\n\n+/)
    .map(b => b.replace(/\n/g, ' ').trim())
    .filter(Boolean);

  const items = blocks.length > 0 ? blocks : [text.replace(/\n/g, ' ').trim()];

  for (const block of items) {
    if (!block) continue;
    const p = document.createElement('p');
    if (extraClass) p.className = extraClass;
    p.textContent = block;
    container.appendChild(p);
  }
}

/** Build a ✦ insertion marker pill showing the first sentence of nextChunkText. */
function buildInsertionMarker(nextChunkText) {
  const snippet = firstSentenceSnippet(nextChunkText, 72);
  const div = document.createElement('div');
  div.className = 'insertion-marker';
  div.innerHTML = `
    <span class="insertion-marker__line"></span>
    <span class="insertion-marker__pill">
      <span class="insertion-marker__icon" aria-hidden="true">✦</span>
      <span>Add heading here</span>
      <span class="insertion-marker__sentence">— "<em>${esc(snippet)}</em>"</span>
    </span>
    <span class="insertion-marker__line"></span>
  `;
  return div;
}

// ── Timeline ───────────────────────────────────────────────
/**
 * Draw the proportional SVG timeline.
 *
 * Per headed section (from left to right, proportional to word count):
 *   [H2]           ← heading level label
 *    ○             ← circle at START of section
 *  250 words       ← word count, colour-coded
 *   🔥             ← quality indicator
 *  "First few…"   ← first-sentence snippet (context)
 */
function drawTimeline(sections, svgEl_root) {
  svgEl_root.innerHTML = '';

  const totalWords  = sections.reduce((n, s) => n + s.wordCount, 0);
  const headedSects = sections.filter(s => !s.isIntro);
  if (totalWords === 0 || headedSects.length === 0) return;

  const containerW = svgEl_root.getBoundingClientRect().width || 680;
  const PAD_L = 50;
  const PAD_R = 50;
  const LINE_W = containerW - PAD_L - PAD_R;
  const LINE_Y = 68;
  const SVG_H  = 195;
  const R      = 15;

  svgEl_root.setAttribute('viewBox', `0 0 ${containerW} ${SVG_H}`);
  svgEl_root.style.height = `${SVG_H}px`;

  // ── Position data: circle at start of each section ──
  let cumWords = 0;
  const positioned = sections.map(section => {
    const x    = PAD_L + (cumWords / totalWords) * LINE_W;
    const endX = PAD_L + ((cumWords + section.wordCount) / totalWords) * LINE_W;
    cumWords  += section.wordCount;
    return { section, x, endX };
  });

  // Base grey line
  svgEl_root.appendChild(svgEl('line', {
    x1: PAD_L, y1: LINE_Y,
    x2: PAD_L + LINE_W, y2: LINE_Y,
    stroke: '#ccc', 'stroke-width': 6, 'stroke-linecap': 'round',
  }));

  // Coloured segment overlays
  for (const { section, x, endX } of positioned) {
    if (section.isIntro || endX - x < 1) continue;
    svgEl_root.appendChild(svgEl('line', {
      x1: x, y1: LINE_Y, x2: endX, y2: LINE_Y,
      stroke: qualityColor(section.quality),
      'stroke-width': 6, 'stroke-linecap': 'butt', opacity: 0.35,
    }));
  }

  // Black hairline on top
  svgEl_root.appendChild(svgEl('line', {
    x1: PAD_L, y1: LINE_Y,
    x2: PAD_L + LINE_W, y2: LINE_Y,
    stroke: '#000', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.18,
  }));

  // Heading markers
  for (const { section, x } of positioned) {
    if (section.isIntro) continue;

    const color = qualityColor(section.quality);

    // Heading level label above circle
    svgEl_root.appendChild(svgEl('text', {
      x, y: LINE_Y - R - 10,
      'text-anchor': 'middle', 'font-family': 'Inter, system-ui, sans-serif',
      'font-size': 11, 'font-weight': 700, 'letter-spacing': '0.04em', fill: '#000',
    }, `H${section.heading.level}`));

    // Circle
    svgEl_root.appendChild(svgEl('circle', {
      cx: x, cy: LINE_Y, r: R,
      fill: '#fff', stroke: '#000', 'stroke-width': 2.5,
    }));

    // Word count
    svgEl_root.appendChild(svgEl('text', {
      x, y: LINE_Y + R + 18,
      'text-anchor': 'middle', 'font-family': 'Inter, system-ui, sans-serif',
      'font-size': 11, 'font-weight': 700, fill: color,
    }, `${section.wordCount} words`));

    // Quality indicator
    if (section.quality === 'good') {
      svgEl_root.appendChild(svgEl('text', {
        x, y: LINE_Y + R + 36, 'text-anchor': 'middle', 'font-size': 13,
      }, '🔥'));
    } else {
      svgEl_root.appendChild(svgEl('text', {
        x, y: LINE_Y + R + 36,
        'text-anchor': 'middle', 'font-family': 'Inter, system-ui, sans-serif',
        'font-size': 14, 'font-weight': 900, fill: color,
      }, '✕'));
    }

    // First-sentence snippet (context beneath the indicator)
    if (section.content.trim()) {
      const snippet = firstSentenceSnippet(section.content, 36);
      svgEl_root.appendChild(svgEl('text', {
        x, y: LINE_Y + R + 54,
        'text-anchor': 'middle', 'font-family': 'Inter, system-ui, sans-serif',
        'font-size': 9, 'font-style': 'italic', fill: '#bbb',
      }, snippet));
    }
  }
}

function qualityColor(quality) {
  if (quality === 'good')  return COLOR_GOOD;
  if (quality === 'long')  return COLOR_LONG;
  if (quality === 'short') return COLOR_SHORT;
  return COLOR_INTRO;
}

// ── Text With Headings Renderer ─────────────────────────────
/**
 * Render the full document:
 * - Existing headings styled as <h1>–<h6>
 * - Long sections split with ✦ insertion markers showing first sentence of each chunk
 * - Short sections flagged with a gentle hint
 * - No-headings case: auto-split entire text at ~TARGET_WORDS intervals
 */
function renderTextWithHeadings(sections) {
  const wrap = document.createElement('div');
  wrap.className = 'text-preview';

  const hasHeadings = sections.some(s => !s.isIntro);

  if (!hasHeadings) {
    // Auto-split full text and show where headings should go
    const fullText = sections.map(s => s.content).join('\n\n');
    const chunks = chunkText(fullText);
    chunks.forEach((chunk, i) => {
      appendParas(wrap, chunk);
      if (i < chunks.length - 1) {
        wrap.appendChild(buildInsertionMarker(chunks[i + 1]));
      }
    });
    return wrap;
  }

  for (const section of sections) {
    // Styled heading
    if (section.heading) {
      const level = Math.min(section.heading.level, 6);
      const h = document.createElement(`h${level}`);
      h.className = `preview-heading preview-heading--${section.quality}`;
      h.textContent = section.heading.text;
      wrap.appendChild(h);
    }

    const text = section.content.trim();
    if (!text) continue;

    if (section.quality === 'long') {
      // Split and interleave insertion markers
      const chunks = chunkText(text);
      chunks.forEach((chunk, i) => {
        appendParas(wrap, chunk, section.isIntro ? 'preview-intro' : '');
        if (i < chunks.length - 1) {
          wrap.appendChild(buildInsertionMarker(chunks[i + 1]));
        }
      });
    } else {
      appendParas(wrap, text, section.isIntro ? 'preview-intro' : '');
    }

    // Gentle nudge for short sections
    if (section.quality === 'short' && !section.isIntro) {
      const hint = document.createElement('p');
      hint.className = 'short-hint';
      hint.textContent = '↕ Section is short — consider expanding or merging with the next section';
      wrap.appendChild(hint);
    }
  }

  return wrap;
}

// ── Section Cards ──────────────────────────────────────────
function renderCards(sections, container) {
  container.innerHTML = '';

  for (const section of sections) {
    const card = document.createElement('div');
    card.className = `section-card section-card--${section.quality}`;

    const header = document.createElement('div');
    header.className = 'section-card-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'section-card-title';

    const badge = document.createElement('span');
    badge.className = 'heading-badge' + (section.isIntro ? ' heading-badge--intro' : '');
    badge.textContent = section.isIntro ? 'INTRO' : `H${section.heading.level}`;
    titleEl.appendChild(badge);

    if (!section.isIntro) {
      const ht = document.createElement('span');
      ht.className = 'heading-text';
      ht.textContent = section.heading.text;
      titleEl.appendChild(ht);
    }

    header.appendChild(titleEl);

    const meta = document.createElement('div');
    meta.className = 'section-meta';

    const wc = document.createElement('span');
    wc.className = `word-count word-count--${section.quality}`;
    wc.textContent = `${section.wordCount} word${section.wordCount !== 1 ? 's' : ''}`;
    meta.appendChild(wc);

    const hint = document.createElement('span');
    hint.className = 'quality-hint';
    hint.textContent = qualityHint(section.quality);
    meta.appendChild(hint);

    header.appendChild(meta);
    card.appendChild(header);

    if (section.content.trim()) {
      const words = section.content.trim().split(/\s+/);
      const preview = document.createElement('p');
      preview.className = 'section-preview';
      preview.textContent = words.slice(0, 40).join(' ') + (words.length > 40 ? ' …' : '');
      card.appendChild(preview);
    }

    container.appendChild(card);
  }
}

function qualityHint(quality) {
  if (quality === 'good')  return `🔥 ideal length`;
  if (quality === 'long')  return `✕ too long — aim for ~${TARGET_WORDS} words`;
  if (quality === 'short') return `✕ too short — consider expanding`;
  return '';
}

// ── No-Headings Notice ─────────────────────────────────────
function buildNoHeadingsMessage(totalWords) {
  const needed = Math.ceil(totalWords / TARGET_WORDS);
  const div = document.createElement('div');
  div.className = 'no-headings-msg';
  div.innerHTML = `
    <h3>No headings detected</h3>
    <p>
      Your text has <strong>${totalWords.toLocaleString()} words</strong> and no markdown headings.<br>
      For ideal readability, add roughly <strong>${needed} heading${needed !== 1 ? 's' : ''}</strong>
      — one every ~${TARGET_WORDS} words.<br><br>
      Markdown syntax: <code># Heading 1</code> &nbsp; <code>## Heading 2</code> &nbsp; <code>### Heading 3</code>
    </p>
  `;
  return div;
}

// ── Stats Bar ──────────────────────────────────────────────
function buildStatsBar(stats) {
  const bar = document.createElement('div');
  bar.className = 'stats-bar';

  const scoreClass = stats.score === null ? ''
    : stats.score >= 80 ? '' : stats.score >= 50 ? 'score-warn' : 'score-bad';

  bar.innerHTML = `
    <span class="stat"><strong>${stats.totalWords.toLocaleString()}</strong> total words</span>
    <span class="stat"><strong>${stats.headedCount}</strong> section${stats.headedCount !== 1 ? 's' : ''}</span>
    <span class="stat">Target: <strong>~${TARGET_WORDS} words</strong> per section</span>
    ${stats.score !== null
      ? `<span class="stat stat-score ${scoreClass}">Score: <strong>${stats.score}%</strong></span>`
      : ''}
  `;
  return bar;
}

// ── Main Render ────────────────────────────────────────────
function render(sections) {
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = '';
  resultsEl.hidden = false;

  const stats       = computeStats(sections);
  const hasHeadings = sections.some(s => !s.isIntro);

  // Stats bar (always)
  resultsEl.appendChild(buildStatsBar(stats));

  if (!hasHeadings) {
    // No headings — show advice notice
    resultsEl.appendChild(buildNoHeadingsMessage(stats.totalWords));
  } else {
    // Timeline
    const timelineWrap = document.createElement('div');
    timelineWrap.className = 'timeline-wrap';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.className = 'timeline-svg';
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Heading distribution timeline — word counts between headings');
    timelineWrap.appendChild(svg);
    resultsEl.appendChild(timelineWrap);

    // Section cards
    const sectionsTitle = document.createElement('h2');
    sectionsTitle.className = 'sections-title';
    sectionsTitle.textContent = 'Sections';
    resultsEl.appendChild(sectionsTitle);

    const sectionsListEl = document.createElement('div');
    sectionsListEl.className = 'sections-list';
    resultsEl.appendChild(sectionsListEl);

    requestAnimationFrame(() => {
      drawTimeline(sections, svg);
      renderCards(sections, sectionsListEl);
    });
  }

  // ── Text with headings (always shown) ──
  const previewSection = document.createElement('div');
  previewSection.className = 'text-preview-section';

  const previewTitle = document.createElement('h2');
  previewTitle.className = 'sections-title';
  previewTitle.textContent = hasHeadings
    ? 'Your text — with suggested structure'
    : 'Your text — with suggested heading positions';
  previewSection.appendChild(previewTitle);

  previewSection.appendChild(renderTextWithHeadings(sections));
  resultsEl.appendChild(previewSection);

  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Analyze ────────────────────────────────────────────────
function analyze() {
  const text = document.getElementById('text-input').value;
  if (!text.trim()) {
    document.getElementById('text-input').focus();
    return;
  }
  render(buildSections(text));
}

// ── Clear ──────────────────────────────────────────────────
function clearAll() {
  const input     = document.getElementById('text-input');
  const resultsEl = document.getElementById('results');
  input.value       = '';
  resultsEl.innerHTML = '';
  resultsEl.hidden  = true;
  input.focus();
}

// ── Resize ─────────────────────────────────────────────────
let resizeTimer = null;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const svg  = document.querySelector('.timeline-svg');
    const text = document.getElementById('text-input').value;
    if (!svg || !text.trim()) return;
    drawTimeline(buildSections(text), svg);
  }, 180);
}

// ── Event Listeners ────────────────────────────────────────
document.getElementById('analyze-btn').addEventListener('click', analyze);
document.getElementById('clear-btn').addEventListener('click', clearAll);

document.getElementById('text-input').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    analyze();
  }
});

window.addEventListener('resize', onResize);
