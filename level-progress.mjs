#!/usr/bin/env node
// Usage: WANIKANI_API_TOKEN=xxxx node level-progress.mjs

const token = process.env.WANIKANI_API_TOKEN;
if (!token) {
  console.error("Error: WANIKANI_API_TOKEN is required");
  process.exit(1);
}

async function fetchAllPages(url) {
  const items = [];
  let next = url;
  while (next) {
    const res = await fetch(next, {
      headers: { Authorization: `Bearer ${token}`, "Wanikani-Revision": "20170710" },
    });
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    const body = await res.json();
    items.push(...body.data);
    next = body.pages?.next_url ?? null;
  }
  return items;
}

console.error("Fetching level progressions...");
const progressions = await fetchAllPages("https://api.wanikani.com/v2/level_progressions");

const levels = progressions
  .map((p) => ({
    level: p.data.level,
    unlockedAt: p.data.unlocked_at ? new Date(p.data.unlocked_at) : null,
    passedAt: p.data.passed_at ? new Date(p.data.passed_at) : null,
  }))
  .filter((p) => p.unlockedAt)
  .sort((a, b) => a.level - b.level);

// Days to pass each level (null if not yet passed)
const daysPerLevel = levels.map((p) => {
  if (!p.passedAt) return null;
  const start = p.unlockedAt;
  const end = p.passedAt;
  return Math.round(((end - start) / (1000 * 60 * 60 * 24)) * 10) / 10;
});

const passed = daysPerLevel.filter((d) => d !== null);
const avg = passed.length
  ? Math.round((passed.reduce((a, b) => a + b, 0) / passed.length) * 10) / 10
  : 0;
const best = passed.length ? Math.min(...passed) : 0;
const worst = passed.length ? Math.max(...passed) : 0;

const labels = levels.map((p) => `Level ${p.level}`);
const passedDates = levels.map((p) =>
  p.passedAt ? p.passedAt.toISOString().split("T")[0] : null
);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WaniKani Level Progress</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; background: #1a1a2e; color: #eee; margin: 0; padding: 24px; }
    h1 { color: #f4a261; margin-bottom: 4px; }
    .subtitle { color: #aaa; margin-bottom: 32px; font-size: 14px; }
    .stats { display: flex; gap: 24px; margin-bottom: 40px; flex-wrap: wrap; }
    .stat { background: #16213e; border-radius: 8px; padding: 16px 24px; min-width: 120px; }
    .stat-value { font-size: 28px; font-weight: bold; color: #f4a261; }
    .stat-label { font-size: 12px; color: #aaa; margin-top: 4px; }
    .chart-wrap { background: #16213e; border-radius: 8px; padding: 24px; margin-bottom: 32px; }
    .chart-wrap h2 { margin: 0 0 16px; font-size: 16px; color: #ccc; }
    canvas { max-height: 350px; }
  </style>
</head>
<body>
  <h1>WaniKani Level Progress</h1>
  <p class="subtitle">${levels.length} levels unlocked · ${passed.length} levels passed</p>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${levels.length}</div>
      <div class="stat-label">Levels reached</div>
    </div>
    <div class="stat">
      <div class="stat-value">${avg}d</div>
      <div class="stat-label">Avg days / level</div>
    </div>
    <div class="stat">
      <div class="stat-value">${best}d</div>
      <div class="stat-label">Fastest level</div>
    </div>
    <div class="stat">
      <div class="stat-value">${worst}d</div>
      <div class="stat-label">Slowest level</div>
    </div>
  </div>

  <div class="chart-wrap">
    <h2>Days to pass each level</h2>
    <canvas id="daysChart"></canvas>
  </div>

  <div class="chart-wrap">
    <h2>Cumulative levels passed over time</h2>
    <canvas id="cumulativeChart"></canvas>
  </div>

  <script>
    const labels = ${JSON.stringify(labels)};
    const daysPerLevel = ${JSON.stringify(daysPerLevel)};
    const passedDates = ${JSON.stringify(passedDates)};
    const avg = ${avg};

    new Chart(document.getElementById("daysChart"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Days to pass",
            data: daysPerLevel,
            backgroundColor: daysPerLevel.map(d =>
              d === null ? "#444" : d <= avg ? "#2ec4b6" : "#f4a261"
            ),
          },
          {
            label: "Average",
            data: daysPerLevel.map(() => avg),
            type: "line",
            borderColor: "#e76f51",
            borderDash: [4, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: "#ccc" } } },
        scales: {
          x: { ticks: { color: "#888", maxRotation: 45 }, grid: { color: "#2a2a4a" } },
          y: {
            ticks: { color: "#888" },
            grid: { color: "#2a2a4a" },
            title: { display: true, text: "Days", color: "#888" },
          },
        },
      },
    });

    const cumPoints = passedDates
      .map((d, i) => d ? { x: d, y: i + 1 } : null)
      .filter(Boolean);

    new Chart(document.getElementById("cumulativeChart"), {
      type: "line",
      data: {
        datasets: [{
          label: "Levels passed",
          data: cumPoints,
          borderColor: "#2ec4b6",
          backgroundColor: "rgba(46,196,182,0.1)",
          fill: true,
          tension: 0.2,
          pointRadius: 3,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: "#ccc" } } },
        scales: {
          x: {
            type: "time",
            time: { unit: "month" },
            ticks: { color: "#888" },
            grid: { color: "#2a2a4a" },
          },
          y: {
            ticks: { color: "#888" },
            grid: { color: "#2a2a4a" },
            title: { display: true, text: "Level", color: "#888" },
          },
        },
      },
    });
  </script>
</body>
</html>`;

import { writeFileSync } from "fs";
import { execSync } from "child_process";

const outPath = "/tmp/wk-level-progress.html";
writeFileSync(outPath, html);
console.error(`Report written to ${outPath}`);
execSync(`open "${outPath}"`);
