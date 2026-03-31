#!/usr/bin/env node
import { parseArgs } from "node:util";
import { WaniKaniClient } from "./wanikani-client.js";
import { analyze } from "./analyzer.js";
import { getAdvice } from "./advisor.js";
import { openReport } from "./html-report.js";

function printUsage(): void {
  console.log(`
wanikani-advisor - AI-powered study advisor for WaniKani

Usage:
  npx tsx src/index.ts [options]

Options:
  --limit, -l <n>       Number of worst items to analyze (default: 20)
  --min-errors, -m <n>  Minimum errors to include an item (default: 3)
  --types, -t <types>   Subject types: kanji,vocabulary,radical (default: kanji,vocabulary)
  --no-ai               Skip Claude AI advice, just show raw analysis
  --cli                 Output to terminal instead of opening HTML report
  --help, -h            Show this help

Environment variables:
  WANIKANI_API_TOKEN    Your WaniKani API token (required)
  AWS_PROFILE           AWS profile for Bedrock access (or use default AWS credentials)
  AWS_REGION            AWS region (default: us-east-1)
`);
}

function printAnalysis(analysis: Awaited<ReturnType<typeof analyze>>): void {
  const { troubleItems, similarGroups, summary } = analysis;

  console.log("\n═══════════════════════════════════════════");
  console.log("  WaniKani Trouble Items Report");
  console.log("═══════════════════════════════════════════\n");
  console.log(`Items reviewed: ${summary.totalReviewed}`);
  console.log(`Avg accuracy on trouble items: ${summary.avgAccuracy}%`);
  console.log(`Weakest area: ${summary.worstCategory} answers\n`);

  console.log("───────────────────────────────────────────");
  console.log("  Top Trouble Items");
  console.log("───────────────────────────────────────────\n");

  for (const item of troubleItems) {
    const bar = (rate: number) => {
      const filled = Math.round(rate * 10);
      return "█".repeat(filled) + "░".repeat(10 - filled);
    };

    console.log(
      `${item.characters ?? "?"} [${item.subjectType}] Level ${item.level} — ${item.srsName}`
    );
    console.log(`  Meanings: ${item.meanings.join(", ")}`);
    if (item.readings.length > 0) {
      console.log(`  Readings: ${item.readings.join(", ")}`);
    }
    console.log(
      `  Meaning errors: ${bar(item.meaningErrorRate)} ${(item.meaningErrorRate * 100).toFixed(0)}% (${item.meaningIncorrect} wrong)`
    );
    console.log(
      `  Reading errors: ${bar(item.readingErrorRate)} ${(item.readingErrorRate * 100).toFixed(0)}% (${item.readingIncorrect} wrong)`
    );
    console.log();
  }

  if (similarGroups.length > 0) {
    console.log("───────────────────────────────────────────");
    console.log("  Confusion Groups");
    console.log("───────────────────────────────────────────\n");

    for (const group of similarGroups) {
      console.log(`⚡ ${group.label}`);
      console.log(`  ${group.reason}`);
      for (const item of group.items) {
        console.log(
          `    ${item.characters} — ${item.meanings.slice(0, 3).join(", ")} (${item.totalErrors} errors)`
        );
      }
      console.log();
    }
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      limit: { type: "string", short: "l", default: "20" },
      "min-errors": { type: "string", short: "m", default: "3" },
      types: { type: "string", short: "t", default: "kanji,vocabulary" },
      "no-ai": { type: "boolean", default: false },
      cli: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  const wanikaniToken = process.env.WANIKANI_API_TOKEN;
  if (!wanikaniToken) {
    console.error("Error: WANIKANI_API_TOKEN environment variable is required.");
    console.error("Get your token at: https://www.wanikani.com/settings/personal_access_tokens");
    process.exit(1);
  }

  const limit = parseInt(values.limit!, 10);
  const minErrors = parseInt(values["min-errors"]!, 10);
  const subjectTypes = values.types!.split(",");

  const client = new WaniKaniClient(wanikaniToken);

  const analysis = await analyze(client, { limit, subjectTypes, minErrors });

  if (analysis.troubleItems.length === 0) {
    console.log("\nNo items found with enough errors. Try lowering --min-errors.");
    process.exit(0);
  }

  const advice = values["no-ai"] ? null : await getAdvice(analysis);

  if (values.cli) {
    printAnalysis(analysis);
    if (advice) {
      console.log("═══════════════════════════════════════════");
      console.log("  AI Study Advice");
      console.log("═══════════════════════════════════════════\n");
      console.log(advice);
      console.log();
    }
  } else {
    const filePath = openReport(analysis, advice);
    console.log(`Report opened in browser: ${filePath}`);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
