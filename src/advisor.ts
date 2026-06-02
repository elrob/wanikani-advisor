import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import type { AnalysisResult, TroubleItem, SimilarGroup } from "./types.js";

function formatItemForPrompt(item: TroubleItem): string {
  const totalAttempts =
    item.meaningCorrect + item.meaningIncorrect + item.readingCorrect + item.readingIncorrect;
  return [
    `- ${item.characters} (${item.subjectType}, Level ${item.level})`,
    `  Meanings: ${item.meanings.join(", ")}`,
    item.readings.length > 0 ? `  Readings: ${item.readings.join(", ")}` : null,
    `  SRS Stage: ${item.srsName}`,
    `  Total errors: ${item.totalErrors} across ${totalAttempts} attempts`,
    `  Meaning: ${item.meaningIncorrect} wrong / ${item.meaningCorrect + item.meaningIncorrect} attempts (${(item.meaningErrorRate * 100).toFixed(0)}% error rate)`,
    `  Reading: ${item.readingIncorrect} wrong / ${item.readingCorrect + item.readingIncorrect} attempts (${(item.readingErrorRate * 100).toFixed(0)}% error rate)`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatGroupForPrompt(group: SimilarGroup): string {
  const items = group.items.map(formatItemForPrompt).join("\n");
  return `\nConfusion Group: ${group.label}\nReason: ${group.reason}\n${items}`;
}

function buildPrompt(analysis: AnalysisResult): string {
  const itemsText = analysis.troubleItems.map(formatItemForPrompt).join("\n\n");

  const groupsText =
    analysis.similarGroups.length > 0
      ? "\n\n## Confusion Groups (items you mix up)\n" +
        analysis.similarGroups.map(formatGroupForPrompt).join("\n")
      : "";

  return `You are a Japanese language learning expert specializing in kanji and vocabulary. A WaniKani user is struggling with the following items. Analyze their mistake patterns and provide actionable study advice.

## Overall Stats
- Items reviewed: ${analysis.summary.totalReviewed}
- Average accuracy on trouble items: ${analysis.summary.avgAccuracy}%
- Worst area: ${analysis.summary.worstCategory} answers

## Trouble Items (sorted by most errors)
${itemsText}
${groupsText}

Please provide:

1. **Pattern Analysis**: Identify any patterns in the mistakes. Are there common radicals, similar-looking kanji, readings that use the same sounds, or meaning categories that cause confusion?

2. **Confusion Pairs/Groups**: For items that are visually similar or share meanings/readings, explain exactly how to distinguish them. Give specific visual differences, radical breakdowns, or memorable distinctions.

3. **Personalized Mnemonics**: For the top 5-10 worst items, suggest memorable mnemonics or memory tricks. Build on the kanji components and radicals where possible.

4. **Reading Tips**: For items with high reading error rates, explain any patterns (onyomi vs kunyomi usage, common readings that apply across multiple kanji, etc.)

5. **Study Recommendations**: Prioritized, specific actions they can take to improve.

Use Japanese characters where helpful. Be specific and practical — avoid generic study advice.`;
}

export async function getAdvice(
  analysis: AnalysisResult
): Promise<string> {
  const client = new AnthropicBedrock();
  const prompt = buildPrompt(analysis);

  console.error("Asking Claude for personalized advice...");

  const response = await client.messages.create({
    model: "us.anthropic.claude-opus-4-6-v1",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text ?? "No advice generated.";
}
