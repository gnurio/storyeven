'use strict';

/* ============================================================
   StoryEven — Core Application
   ============================================================
   Features:
   - Parse markdown headings (# ## ### …) from pasted text
   - Count words in each section between headings
   - Visualise sections on a proportional SVG timeline
   - Colour-code by quality: 🔥 ideal (~250 w), ✕ too long, ✕ too short
   - Render section cards with heading, word count, and preview
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
/**
 * Count words in a string.
 */
function countWords(str) {
  if (!str.trim()) return 0;
  return str.trim().split(/\s+/).length;
}

/**
 * Return quality tier for a word count.
 * @returns {'good'|'long'|'short'|'intro'}
 */
function getQuality(wordCount, isIntro) {
  if (isIntro) return 'intro';
  if (wordCount >= MIN_OK && wordCount <= MAX_OK) return 'good';
  if (wordCount > MAX_OK) return 'long';
  return 'short';
}

// ── Build Processed Sections ───────────────────────────────
/**
 * Build a processed sections array with word counts and quality tiers.
 */
function buildSections(text) {
  const raw = parseMarkdown(text);

  return raw
    .map((s, i) => {
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
    // Drop completely empty intro (nothing before first heading)
    .filter(s => s.heading !== null || s.wordCount > 0);
}

// ── Stats ──────────────────────────────────────────────────
function computeStats(sections) {
  const totalWords      = sections.reduce((n, s) => n + s.wordCount, 0);
  const headedSections  = sections.filter(s => !s.isIntro);
  const goodCount       = headedSections.filter(s => s.quality === 'good').length;
  const score           = headedSections.length > 0
    ? Math.round((goodCount / headedSections.length) * 100)
    : null;

  return {
    totalWords,
    headedCount:  headedSections.length,
    totalCount:   sections.length,
    score,
    goodCount,
  };
}

// ── SVG Helpers ────────────────────────────────────────────
function svgEl(tag, attrs, text) {
  const e = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      e.setAttribute(k, String(v));
    }
  }
  if (text != null) e.textContent = String(text);
  return e;
}

// ── Timeline ───────────────────────────────────────────────
/**
 * Draw the proportional SVG timeline.
 *
 * Layout (per headed section):
 *   [H2]   ← heading level label (above line)
 *    ○     ← circle marker on line (at START of section)
 *  250w    ← word count (below line, coloured)
 *   🔥     ← quality indicator
 *
 * Spacing between circles is proportional to word count of each section.
 */
function drawTimeline(sections, svgEl_root) {
  svgEl_root.innerHTML = '';

  const totalWords    = sections.reduce((n, s) => n + s.wordCount, 0);
  const headedSects   = sections.filter(s => !s.isIntro);
  if (totalWords === 0 || headedSects.length === 0) return;

  // Dimensions
  const containerW = svgEl_root.getBoundingClientRect().width || 680;
  const PAD_L      = 50;
  const PAD_R      = 50;
  const LINE_W     = containerW - PAD_L - PAD_R;
  const LINE_Y     = 68;
  const SVG_H      = 155;
  const R          = 15;  // circle radius

  svgEl_root.setAttribute('viewBox', `0 0 ${containerW} ${SVG_H}`);
  svgEl_root.style.height = `${SVG_H}px`;

  // ── Build position data ──
  // Circle x = cumulative words BEFORE this section (proportional to total)
  let cumWords = 0;
  const positioned = sections.map(section => {
    const x     = PAD_L + (cumWords / totalWords) * LINE_W;
    const endX  = PAD_L + ((cumWords + section.wordCount) / totalWords) * LINE_W;
    cumWords   += section.wordCount;
    return { section, x, endX };
  });

  // ── Base grey line ──
  svgEl_root.appendChild(svgEl('line', {
    x1: PAD_L, y1: LINE_Y,
    x2: PAD_L + LINE_W, y2: LINE_Y,
    stroke: '#ccc',
    'stroke-width': 6,
    'stroke-linecap': 'round',
  }));

  // ── Coloured segment overlays (per section) ──
  for (const { section, x, endX } of positioned) {
    if (section.isIntro || endX - x < 1) continue;
    const color = qualityColor(section.quality);
    svgEl_root.appendChild(svgEl('line', {
      x1: x,    y1: LINE_Y,
      x2: endX, y2: LINE_Y,
      stroke: color,
      'stroke-width': 6,
      'stroke-linecap': 'butt',
      opacity: 0.35,
    }));
  }

  // ── Black hairline on top ──
  svgEl_root.appendChild(svgEl('line', {
    x1: PAD_L, y1: LINE_Y,
    x2: PAD_L + LINE_W, y2: LINE_Y,
    stroke: '#000',
    'stroke-width': 3,
    'stroke-linecap': 'round',
    opacity: 0.18,
  }));

  // ── Heading markers ──
  for (const { section, x } of positioned) {
    if (section.isIntro) continue;

    const color = qualityColor(section.quality);

    // Heading level label above circle
    svgEl_root.appendChild(svgEl('text', {
      x, y: LINE_Y - R - 10,
      'text-anchor':  'middle',
      'font-family':  'Inter, system-ui, sans-serif',
      'font-size':    11,
      'font-weight':  700,
      'letter-spacing': '0.04em',
      fill: '#000',
    }, `H${section.heading.level}`));

    // Circle (white fill, black stroke)
    svgEl_root.appendChild(svgEl('circle', {
      cx: x, cy: LINE_Y, r: R,
      fill: '#fff',
      stroke: '#000',
      'stroke-width': 2.5,
    }));

    // Word count below circle
    svgEl_root.appendChild(svgEl('text', {
      x, y: LINE_Y + R + 18,
      'text-anchor':  'middle',
      'font-family':  'Inter, system-ui, sans-serif',
      'font-size':    11,
      'font-weight':  700,
      fill: color,
    }, `${section.wordCount} words`));

    // Quality indicator
    if (section.quality === 'good') {
      // Fire emoji — good section
      svgEl_root.appendChild(svgEl('text', {
        x, y: LINE_Y + R + 36,
        'text-anchor': 'middle',
        'font-size':   13,
      }, '🔥'));
    } else {
      // ✕ mark — bad section
      svgEl_root.appendChild(svgEl('text', {
        x, y: LINE_Y + R + 36,
        'text-anchor':  'middle',
        'font-family':  'Inter, system-ui, sans-serif',
        'font-size':    14,
        'font-weight':  900,
        fill: color,
      }, '✕'));
    }
  }
}

function qualityColor(quality) {
  if (quality === 'good')  return COLOR_GOOD;
  if (quality === 'long')  return COLOR_LONG;
  if (quality === 'short') return COLOR_SHORT;
  return COLOR_INTRO;
}

// ── Section Cards ──────────────────────────────────────────
/**
 * Render the section detail cards below the timeline.
 */
function renderCards(sections, container) {
  container.innerHTML = '';

  for (const section of sections) {
    const card = document.createElement('div');
    card.className = `section-card section-card--${section.quality}`;

    // Header row
    const header = document.createElement('div');
    header.className = 'section-card-header';

    // Left: badge + heading text
    const titleEl = document.createElement('div');
    titleEl.className = 'section-card-title';

    const badge = document.createElement('span');
    badge.className = 'heading-badge' + (section.isIntro ? ' heading-badge--intro' : '');
    badge.textContent = section.isIntro
      ? 'INTRO'
      : `H${section.heading.level}`;
    titleEl.appendChild(badge);

    if (!section.isIntro) {
      const headingText = document.createElement('span');
      headingText.className = 'heading-text';
      headingText.textContent = section.heading.text;
      titleEl.appendChild(headingText);
    }

    header.appendChild(titleEl);

    // Right: word count + quality hint
    const meta = document.createElement('div');
    meta.className = 'section-meta';

    const wc = document.createElement('span');
    wc.className = `word-count word-count--${section.quality}`;
    wc.textContent = `${section.wordCount} word${section.wordCount !== 1 ? 's' : ''}`;
    meta.appendChild(wc);

    const hint = document.createElement('span');
    hint.className = 'quality-hint';
    hint.textContent = qualityHint(section.quality, section.wordCount);
    meta.appendChild(hint);

    header.appendChild(meta);
    card.appendChild(header);

    // Content preview (first ~40 words)
    if (section.content.trim()) {
      const words   = section.content.trim().split(/\s+/);
      const preview = document.createElement('p');
      preview.className = 'section-preview';
      preview.textContent = words.slice(0, 40).join(' ') + (words.length > 40 ? ' …' : '');
      card.appendChild(preview);
    }

    container.appendChild(card);
  }
}

function qualityHint(quality, wordCount) {
  const diff = TARGET_WORDS - wordCount;
  if (quality === 'good')  return '🔥 ideal length';
  if (quality === 'long')  return `✕ too long — aim for ~${TARGET_WORDS} words`;
  if (quality === 'short') return `✕ too short — consider expanding`;
  return ''; // intro
}

// ── No-Headings Message ────────────────────────────────────
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

  let scoreClass = '';
  if (stats.score !== null) {
    scoreClass = stats.score >= 80 ? '' : stats.score >= 50 ? 'score-warn' : 'score-bad';
  }

  bar.innerHTML = `
    <span class="stat">
      <strong>${stats.totalWords.toLocaleString()}</strong> total words
    </span>
    <span class="stat">
      <strong>${stats.headedCount}</strong> section${stats.headedCount !== 1 ? 's' : ''}
    </span>
    <span class="stat">
      Target: <strong>~${TARGET_WORDS} words</strong> per section
    </span>
    ${stats.score !== null ? `
    <span class="stat stat-score ${scoreClass}">
      Score: <strong>${stats.score}%</strong>
    </span>` : ''}
  `;

  return bar;
}

// ── Main Render ────────────────────────────────────────────
function render(sections) {
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = '';
  resultsEl.hidden = false;

  const stats     = computeStats(sections);
  const hasHeadings = sections.some(s => !s.isIntro);

  // Stats bar
  resultsEl.appendChild(buildStatsBar(stats));

  if (!hasHeadings) {
    // No headings — show advice
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

    // Draw after layout so we have the correct SVG width
    requestAnimationFrame(() => {
      drawTimeline(sections, svg);
      renderCards(sections, sectionsListEl);
    });
  }

  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Analyze ────────────────────────────────────────────────
function analyze() {
  const text = document.getElementById('text-input').value;

  if (!text.trim()) {
    document.getElementById('text-input').focus();
    return;
  }

  const sections = buildSections(text);
  render(sections);
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

// ── Redraw on Resize ───────────────────────────────────────
let resizeTimer = null;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const svg = document.querySelector('.timeline-svg');
    if (!svg) return;
    const text = document.getElementById('text-input').value;
    if (!text.trim()) return;
    const sections = buildSections(text);
    drawTimeline(sections, svg);
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
