export const MAX_SUMMARY_WORDS = 60;

export type Language = "en" | "dv";
export type ReviewStatus = "draft" | "approved" | "rejected";

export type AiDraft = {
  headline: Record<Language, string>;
  summary: Record<Language, string>;
  categories: string[];
  namedEntities: string[];
  factualClaims: Array<{ claim: string; evidence: string }>;
  confidence: number;
  safetyFlags: string[];
};

export interface AiProvider {
  readonly name: "openai" | "gemini";
  createDraft(article: { title: string; body: string; language: Language }): Promise<AiDraft>;
}

export function countWords(value: string): number {
  return value.normalize("NFKC").trim().split(/\s+/u).filter(Boolean).length;
}

export function validateDraft(draft: AiDraft): string[] {
  const errors: string[] = [];
  for (const language of ["en", "dv"] as const) {
    if (!draft.headline[language]?.trim()) errors.push(`${language} headline is required`);
    const words = countWords(draft.summary[language] ?? "");
    if (words === 0) errors.push(`${language} summary is required`);
    if (words > MAX_SUMMARY_WORDS) errors.push(`${language} summary exceeds ${MAX_SUMMARY_WORDS} words`);
  }
  if (draft.confidence < 0 || draft.confidence > 1) errors.push("confidence must be between 0 and 1");
  if (!draft.factualClaims.length) errors.push("at least one source-supported claim is required");
  return errors;
}

export function canPublish(english: ReviewStatus, dhivehi: ReviewStatus, language?: Language): boolean {
  if (language === "en") return english === "approved";
  if (language === "dv") return dhivehi === "approved";
  return english === "approved" && dhivehi === "approved";
}

export function normalizeArticleUrl(input: string): string {
  const url = new URL(input);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP(S) article URLs are supported");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}
