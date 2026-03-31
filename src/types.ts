// WaniKani API types

export interface WKCollection<T> {
  object: "collection";
  url: string;
  data_updated_at: string | null;
  pages: {
    per_page: number;
    next_url: string | null;
    previous_url: string | null;
  };
  total_count: number;
  data: WKResource<T>[];
}

export interface WKResource<T> {
  id: number;
  object: string;
  url: string;
  data_updated_at: string;
  data: T;
}

// Review Statistics
export interface ReviewStatistic {
  created_at: string;
  subject_id: number;
  subject_type: "kanji" | "vocabulary" | "radical" | "kana_vocabulary";
  meaning_correct: number;
  meaning_incorrect: number;
  meaning_max_streak: number;
  meaning_current_streak: number;
  reading_correct: number;
  reading_incorrect: number;
  reading_max_streak: number;
  reading_current_streak: number;
  percentage_correct: number;
  hidden: boolean;
}

// Subjects
export interface SubjectMeaning {
  meaning: string;
  primary: boolean;
  accepted_answer: boolean;
}

export interface SubjectReading {
  reading: string;
  primary: boolean;
  accepted_answer: boolean;
  type?: "onyomi" | "kunyomi" | "nanori";
}

export interface SubjectBase {
  characters: string | null;
  level: number;
  slug: string;
  meanings: SubjectMeaning[];
  meaning_mnemonic: string;
  auxiliary_meanings: { meaning: string; type: string }[];
  document_url: string;
}

export interface KanjiSubject extends SubjectBase {
  readings: SubjectReading[];
  reading_mnemonic: string;
  component_subject_ids: number[];
  amalgamation_subject_ids: number[];
  visually_similar_subject_ids: number[];
}

export interface VocabularySubject extends SubjectBase {
  readings: SubjectReading[];
  reading_mnemonic: string;
  component_subject_ids: number[];
  parts_of_speech: string[];
  context_sentences: { en: string; ja: string }[];
}

export interface RadicalSubject extends SubjectBase {
  amalgamation_subject_ids: number[];
}

export type Subject = KanjiSubject | VocabularySubject | RadicalSubject;

// Assignment
export interface Assignment {
  subject_id: number;
  subject_type: "kanji" | "vocabulary" | "radical" | "kana_vocabulary";
  srs_stage: number;
  available_at: string | null;
  passed_at: string | null;
  burned_at: string | null;
  started_at: string | null;
  unlocked_at: string | null;
}

// Enriched item for analysis
export interface TroubleItem {
  subjectId: number;
  subjectType: "kanji" | "vocabulary" | "radical" | "kana_vocabulary";
  characters: string | null;
  level: number;
  meanings: string[];
  readings: string[];
  meaningCorrect: number;
  meaningIncorrect: number;
  readingCorrect: number;
  readingIncorrect: number;
  percentageCorrect: number;
  meaningErrorRate: number;
  readingErrorRate: number;
  totalErrors: number;
  srsStage: number;
  srsName: string;
  visuallySimilarIds: number[];
  componentIds: number[];
  meaningMnemonic: string;
  readingMnemonic: string;
}

export interface AnalysisResult {
  troubleItems: TroubleItem[];
  similarGroups: SimilarGroup[];
  summary: {
    totalReviewed: number;
    avgAccuracy: number;
    worstCategory: "meaning" | "reading";
  };
}

export interface SimilarGroup {
  label: string;
  items: TroubleItem[];
  reason: string;
}

export const SRS_STAGE_NAMES: Record<number, string> = {
  0: "Initiate",
  1: "Apprentice I",
  2: "Apprentice II",
  3: "Apprentice III",
  4: "Apprentice IV",
  5: "Guru I",
  6: "Guru II",
  7: "Master",
  8: "Enlightened",
  9: "Burned",
};
