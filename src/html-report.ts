import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AnalysisResult, SimilarGroup, TroubleItem } from "./types.js";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function errorBar(rate: number): string {
  const pct = Math.round(rate * 100);
  const color = pct >= 40 ? "#e74c3c" : pct >= 20 ? "#f39c12" : "#2ecc71";
  return `<div class="error-bar"><div class="error-fill" style="width:${pct}%;background:${color}"></div><span>${pct}%</span></div>`;
}

function renderItem(item: TroubleItem): string {
  return `
    <div class="item">
      <div class="item-header">
        <span class="kanji">${escapeHtml(item.characters ?? "?")}</span>
        <div class="item-meta">
          <span class="badge badge-${item.subjectType}">${item.subjectType}</span>
          <span class="badge badge-srs">${escapeHtml(item.srsName)}</span>
          <span class="level">Level ${item.level}</span>
        </div>
      </div>
      <div class="item-details">
        <div class="detail-row">
          <span class="label">Meanings</span>
          <span class="value">${escapeHtml(item.meanings.join(", "))}</span>
        </div>
        ${
          item.readings.length > 0
            ? `
        <div class="detail-row">
          <span class="label">Readings</span>
          <span class="value reading">${escapeHtml(item.readings.join(", "))}</span>
        </div>`
            : ""
        }
        <div class="detail-row">
          <span class="label">Meaning errors</span>
          <div class="value">${errorBar(item.meaningErrorRate)} <small>${item.meaningIncorrect} wrong of ${item.meaningCorrect + item.meaningIncorrect}</small></div>
        </div>
        <div class="detail-row">
          <span class="label">Reading errors</span>
          <div class="value">${errorBar(item.readingErrorRate)} <small>${item.readingIncorrect} wrong of ${item.readingCorrect + item.readingIncorrect}</small></div>
        </div>
      </div>
    </div>`;
}

function renderGroup(group: SimilarGroup): string {
  const kanjiDisplay = group.items
    .map(
      (item) =>
        `<div class="group-kanji-item">
          <span class="group-kanji">${escapeHtml(item.characters ?? "?")}</span>
          <span class="group-meaning">${escapeHtml(item.meanings.slice(0, 2).join(", "))}</span>
          <span class="group-errors">${item.totalErrors} errors</span>
        </div>`
    )
    .join('<span class="group-vs">vs</span>');

  return `
    <div class="group">
      <div class="group-header">${kanjiDisplay}</div>
      <div class="group-reason">${escapeHtml(group.reason)}</div>
    </div>`;
}

function renderAdvice(advice: string): string {
  // Basic markdown-to-HTML: headers, bold, lists, paragraphs
  return advice
    .replace(/^##### (.+)$/gm, "<h5>$1</h5>")
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>")
    .replace(/<p><(h[1-5]|ul|li)/g, "<$1")
    .replace(/<\/(h[1-5]|ul|li)><\/p>/g, "</$1>");
}

export function generateHtml(analysis: AnalysisResult, advice: string | null): string {
  const { troubleItems, similarGroups, summary } = analysis;

  const itemsHtml = troubleItems.map(renderItem).join("\n");
  const groupsHtml =
    similarGroups.length > 0
      ? `<section>
          <h2>Confusion Groups</h2>
          <p class="section-desc">Items you frequently mix up — displayed large for easy comparison.</p>
          ${similarGroups.map(renderGroup).join("\n")}
        </section>`
      : "";

  const adviceHtml = advice
    ? `<section>
        <h2>AI Study Advice</h2>
        <div class="advice">${renderAdvice(advice)}</div>
      </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WaniKani Advisor Report</title>
<style>
  :root {
    --bg: #1a1a2e;
    --surface: #16213e;
    --surface2: #0f3460;
    --text: #e4e4e4;
    --text-muted: #a0a0b0;
    --accent: #e94560;
    --accent2: #533483;
    --kanji-color: #f8f8f2;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    padding: 2rem;
    max-width: 900px;
    margin: 0 auto;
  }
  h1 {
    font-size: 1.8rem;
    margin-bottom: 0.5rem;
    color: var(--accent);
  }
  h2 {
    font-size: 1.4rem;
    margin: 2rem 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid var(--surface2);
  }
  .summary {
    display: flex;
    gap: 2rem;
    margin: 1.5rem 0;
    flex-wrap: wrap;
  }
  .stat {
    background: var(--surface);
    border-radius: 12px;
    padding: 1rem 1.5rem;
    flex: 1;
    min-width: 160px;
  }
  .stat-value { font-size: 2rem; font-weight: 700; color: var(--accent); }
  .stat-label { font-size: 0.85rem; color: var(--text-muted); }

  .item {
    background: var(--surface);
    border-radius: 12px;
    padding: 1.2rem 1.5rem;
    margin-bottom: 1rem;
    transition: transform 0.1s;
  }
  .item:hover { transform: translateX(4px); }
  .item-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.8rem; }
  .kanji {
    font-size: 3rem;
    line-height: 1;
    color: var(--kanji-color);
    font-family: "Hiragino Kaku Gothic Pro", "Yu Gothic", "Noto Sans JP", sans-serif;
  }
  .item-meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  .badge {
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  .badge-kanji { background: #e94560; color: #fff; }
  .badge-vocabulary { background: #a855f7; color: #fff; }
  .badge-radical { background: #0ea5e9; color: #fff; }
  .badge-kana_vocabulary { background: #a855f7; color: #fff; }
  .badge-srs { background: var(--surface2); color: var(--text-muted); }
  .level { font-size: 0.85rem; color: var(--text-muted); }

  .item-details { display: flex; flex-direction: column; gap: 0.4rem; }
  .detail-row { display: flex; align-items: center; gap: 0.8rem; }
  .detail-row .label {
    font-size: 0.8rem;
    color: var(--text-muted);
    min-width: 110px;
    text-align: right;
  }
  .detail-row .value { flex: 1; display: flex; align-items: center; gap: 0.5rem; }
  .detail-row .value small { color: var(--text-muted); font-size: 0.8rem; }
  .reading {
    font-family: "Hiragino Kaku Gothic Pro", "Yu Gothic", "Noto Sans JP", sans-serif;
    font-size: 1.05rem;
  }

  .error-bar {
    width: 120px;
    height: 20px;
    background: var(--surface2);
    border-radius: 10px;
    overflow: hidden;
    position: relative;
  }
  .error-fill {
    height: 100%;
    border-radius: 10px;
    transition: width 0.3s;
  }
  .error-bar span {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 0.7rem;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  }

  /* Confusion groups */
  .group {
    background: var(--surface);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1rem;
  }
  .group-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .group-kanji-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    padding: 0.5rem 1.5rem;
  }
  .group-kanji {
    font-size: 5rem;
    line-height: 1;
    color: var(--kanji-color);
    font-family: "Hiragino Kaku Gothic Pro", "Yu Gothic", "Noto Sans JP", sans-serif;
  }
  .group-meaning { font-size: 0.9rem; color: var(--text-muted); }
  .group-errors { font-size: 0.8rem; color: var(--accent); font-weight: 600; }
  .group-vs {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--accent);
    padding: 0 0.5rem;
  }
  .group-reason {
    text-align: center;
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-top: 0.8rem;
    font-style: italic;
  }

  /* Advice */
  .advice {
    background: var(--surface);
    border-radius: 12px;
    padding: 1.5rem 2rem;
    line-height: 1.8;
  }
  .advice h1, .advice h2, .advice h3, .advice h4, .advice h5 {
    margin: 1.2rem 0 0.5rem;
    border: none;
    padding: 0;
  }
  .advice h3 { font-size: 1.15rem; color: var(--accent); }
  .advice h4 { font-size: 1.05rem; }
  .advice ul { padding-left: 1.5rem; margin: 0.5rem 0; }
  .advice li { margin: 0.3rem 0; }
  .advice code {
    background: var(--surface2);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.9em;
  }
  .advice strong { color: #fff; }
  .section-desc { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem; }

  @media (max-width: 600px) {
    body { padding: 1rem; }
    .kanji { font-size: 2.2rem; }
    .group-kanji { font-size: 3.5rem; }
    .summary { gap: 0.8rem; }
  }
</style>
</head>
<body>
  <h1>WaniKani Advisor Report</h1>

  <div class="summary">
    <div class="stat">
      <div class="stat-value">${summary.totalReviewed}</div>
      <div class="stat-label">Items reviewed</div>
    </div>
    <div class="stat">
      <div class="stat-value">${summary.avgAccuracy}%</div>
      <div class="stat-label">Avg accuracy (trouble items)</div>
    </div>
    <div class="stat">
      <div class="stat-value">${summary.worstCategory}</div>
      <div class="stat-label">Weakest area</div>
    </div>
  </div>

  ${groupsHtml}

  <section>
    <h2>Top Trouble Items</h2>
    ${itemsHtml}
  </section>

  ${adviceHtml}
</body>
</html>`;
}

export function openReport(analysis: AnalysisResult, advice: string | null): string {
  const html = generateHtml(analysis, advice);
  const filePath = join(tmpdir(), `wanikani-report-${Date.now()}.html`);
  writeFileSync(filePath, html, "utf-8");

  const platform = process.platform;
  const openCmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";

  try {
    execSync(`${openCmd} "${filePath}"`);
  } catch {
    // Fall back to just printing the path
  }

  return filePath;
}
