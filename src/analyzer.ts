import type {
  AnalysisResult,
  KanjiSubject,
  SimilarGroup,
  Subject,
  TroubleItem,
  VocabularySubject,
} from "./types.js";
import { SRS_STAGE_NAMES } from "./types.js";
import type { WaniKaniClient } from "./wanikani-client.js";

function errorRate(incorrect: number, correct: number): number {
  const total = incorrect + correct;
  return total === 0 ? 0 : incorrect / total;
}

function hasReadings(subject: Subject): subject is KanjiSubject | VocabularySubject {
  return "readings" in subject;
}

function hasVisuallySimilar(subject: Subject): subject is KanjiSubject {
  return "visually_similar_subject_ids" in subject;
}

export async function analyze(
  client: WaniKaniClient,
  options: {
    limit: number;
    subjectTypes: string[];
    minErrors: number;
  }
): Promise<AnalysisResult> {
  const { limit, subjectTypes, minErrors } = options;

  // 1. Fetch review statistics
  console.error("Fetching review statistics...");
  const stats = await client.getReviewStatistics(subjectTypes);

  // 2. Filter to items with mistakes and sort by total errors
  const withErrors = stats
    .filter((s) => {
      const total = s.data.meaning_incorrect + s.data.reading_incorrect;
      return total >= minErrors && !s.data.hidden;
    })
    .sort(
      (a, b) =>
        b.data.meaning_incorrect +
        b.data.reading_incorrect -
        (a.data.meaning_incorrect + a.data.reading_incorrect)
    )
    .slice(0, limit);

  if (withErrors.length === 0) {
    return {
      troubleItems: [],
      similarGroups: [],
      summary: { totalReviewed: stats.length, avgAccuracy: 0, worstCategory: "meaning" },
    };
  }

  const subjectIds = withErrors.map((s) => s.data.subject_id);

  // 3. Fetch subject details and assignments in parallel
  console.error("Fetching subject details and assignments...");
  const [subjects, assignments] = await Promise.all([
    client.getSubjects(subjectIds),
    client.getAssignments(subjectIds),
  ]);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const assignmentMap = new Map(assignments.map((a) => [a.data.subject_id, a]));

  // 4. Build enriched trouble items
  const troubleItems: TroubleItem[] = withErrors.map((stat) => {
    const subject = subjectMap.get(stat.data.subject_id);
    const assignment = assignmentMap.get(stat.data.subject_id);
    const subjectData = subject?.data;

    const meanings =
      subjectData?.meanings.filter((m) => m.accepted_answer).map((m) => m.meaning) ?? [];

    const readings =
      subjectData && hasReadings(subjectData)
        ? subjectData.readings.filter((r) => r.accepted_answer).map((r) => r.reading)
        : [];

    const visuallySimilarIds =
      subjectData && hasVisuallySimilar(subjectData)
        ? subjectData.visually_similar_subject_ids
        : [];

    const componentIds =
      subjectData && "component_subject_ids" in subjectData
        ? (subjectData as KanjiSubject | VocabularySubject).component_subject_ids
        : [];

    const srsStage = assignment?.data.srs_stage ?? -1;

    return {
      subjectId: stat.data.subject_id,
      subjectType: stat.data.subject_type,
      characters: subjectData?.characters ?? null,
      level: subjectData?.level ?? 0,
      meanings,
      readings,
      meaningCorrect: stat.data.meaning_correct,
      meaningIncorrect: stat.data.meaning_incorrect,
      readingCorrect: stat.data.reading_correct,
      readingIncorrect: stat.data.reading_incorrect,
      percentageCorrect: stat.data.percentage_correct,
      meaningErrorRate: errorRate(stat.data.meaning_incorrect, stat.data.meaning_correct),
      readingErrorRate: errorRate(stat.data.reading_incorrect, stat.data.reading_correct),
      totalErrors: stat.data.meaning_incorrect + stat.data.reading_incorrect,
      srsStage,
      srsName: SRS_STAGE_NAMES[srsStage] ?? "Unknown",
      visuallySimilarIds,
      componentIds,
      meaningMnemonic: subjectData?.meaning_mnemonic ?? "",
      readingMnemonic: subjectData && hasReadings(subjectData) ? subjectData.reading_mnemonic : "",
    };
  });

  // 5. Group visually similar kanji
  const similarGroups = buildSimilarGroups(troubleItems);

  // 6. Summary stats
  const totalMeaningErrors = troubleItems.reduce((s, i) => s + i.meaningIncorrect, 0);
  const totalReadingErrors = troubleItems.reduce((s, i) => s + i.readingIncorrect, 0);
  const avgAccuracy =
    troubleItems.reduce((s, i) => s + i.percentageCorrect, 0) / troubleItems.length;

  return {
    troubleItems,
    similarGroups,
    summary: {
      totalReviewed: stats.length,
      avgAccuracy: Math.round(avgAccuracy),
      worstCategory: totalMeaningErrors >= totalReadingErrors ? "meaning" : "reading",
    },
  };
}

function buildSimilarGroups(items: TroubleItem[]): SimilarGroup[] {
  const groups: SimilarGroup[] = [];
  const itemMap = new Map(items.map((i) => [i.subjectId, i]));
  const visited = new Set<number>();

  // Group by visually similar kanji
  for (const item of items) {
    if (visited.has(item.subjectId) || item.subjectType !== "kanji") continue;

    const similarInTroubleList = item.visuallySimilarIds
      .filter((id) => itemMap.has(id))
      .map((id) => itemMap.get(id) as TroubleItem);

    if (similarInTroubleList.length > 0) {
      const group = [item, ...similarInTroubleList];
      for (const g of group) visited.add(g.subjectId);
      groups.push({
        label: group.map((g) => g.characters).join(" / "),
        items: group,
        reason: "Visually similar kanji that you both struggle with",
      });
    }
  }

  // Group kanji that share meanings you confuse
  const meaningMap = new Map<string, TroubleItem[]>();
  for (const item of items) {
    if (visited.has(item.subjectId)) continue;
    if (item.meaningErrorRate < 0.2) continue; // only items with meaning trouble

    for (const meaning of item.meanings) {
      const key = meaning.toLowerCase();
      if (!meaningMap.has(key)) meaningMap.set(key, []);
      meaningMap.get(key)?.push(item);
    }
  }
  for (const [meaning, group] of meaningMap) {
    if (group.length >= 2) {
      for (const g of group) visited.add(g.subjectId);
      groups.push({
        label: group.map((g) => g.characters).join(" / "),
        items: group,
        reason: `Share the meaning "${meaning}" and you struggle with both`,
      });
    }
  }

  return groups;
}
