import type {
  WKCollection,
  ReviewStatistic,
  Subject,
  Assignment,
} from "./types.js";

const BASE_URL = "https://api.wanikani.com/v2";
const RATE_LIMIT_DELAY = 1100; // slightly over 1s to stay under 60/min

export class WaniKaniClient {
  private token: string;
  private lastRequestTime = 0;

  constructor(token: string) {
    this.token = token;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < RATE_LIMIT_DELAY) {
      await new Promise((resolve) =>
        setTimeout(resolve, RATE_LIMIT_DELAY - elapsed)
      );
    }
    this.lastRequestTime = Date.now();
  }

  private async fetch<T>(url: string): Promise<T> {
    await this.throttle();
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Wanikani-Revision": "20170710",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          "Invalid WaniKani API token. Check your WANIKANI_API_TOKEN."
        );
      }
      if (response.status === 429) {
        const resetTime = response.headers.get("RateLimit-Reset");
        const waitMs = resetTime
          ? Number(resetTime) * 1000 - Date.now() + 500
          : 5000;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        return this.fetch<T>(url);
      }
      throw new Error(`WaniKani API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  private async fetchAllPages<T>(url: string): Promise<WKCollection<T>["data"]> {
    const items: WKCollection<T>["data"] = [];
    let nextUrl: string | null = url;

    while (nextUrl) {
      const page: WKCollection<T> = await this.fetch<WKCollection<T>>(nextUrl);
      items.push(...page.data);
      nextUrl = page.pages.next_url;
      if (nextUrl) {
        process.stderr.write(`  Fetched ${items.length}/${page.total_count}...\r`);
      }
    }

    return items;
  }

  async getReviewStatistics(
    subjectTypes?: string[]
  ): Promise<WKCollection<ReviewStatistic>["data"]> {
    let url = `${BASE_URL}/review_statistics`;
    if (subjectTypes?.length) {
      url += `?subject_types=${subjectTypes.join(",")}`;
    }
    return this.fetchAllPages<ReviewStatistic>(url);
  }

  async getSubjects(
    ids: number[]
  ): Promise<WKCollection<Subject>["data"]> {
    // API allows filtering by ids, but URL length is limited.
    // Batch into chunks of 100.
    const allItems: WKCollection<Subject>["data"] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const url = `${BASE_URL}/subjects?ids=${chunk.join(",")}`;
      const items = await this.fetchAllPages<Subject>(url);
      allItems.push(...items);
    }
    return allItems;
  }

  async getAssignments(
    subjectIds: number[]
  ): Promise<WKCollection<Assignment>["data"]> {
    const allItems: WKCollection<Assignment>["data"] = [];
    for (let i = 0; i < subjectIds.length; i += 100) {
      const chunk = subjectIds.slice(i, i + 100);
      const url = `${BASE_URL}/assignments?subject_ids=${chunk.join(",")}`;
      const items = await this.fetchAllPages<Assignment>(url);
      allItems.push(...items);
    }
    return allItems;
  }
}
