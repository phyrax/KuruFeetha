export type Language = "en" | "dv";
export type TranslationInput = { headline?: string; summary?: string; published?: boolean };

export function wordCount(value: string): number { return value.trim() ? value.trim().split(/\s+/u).length : 0; }

export function validateTranslation(value: TranslationInput | undefined, language: Language): string | null {
  if (!value) return null;
  const headline = value.headline?.trim() ?? "";
  const summary = value.summary?.trim() ?? "";
  if (!headline && !summary) return null;
  if (!headline || !summary) throw new Error(`${language.toUpperCase()} title and summary are both required`);
  if (headline.length > 180) throw new Error(`${language.toUpperCase()} title is too long`);
  if (wordCount(summary) > 60) throw new Error(`${language.toUpperCase()} summary exceeds 60 words`);
  return summary;
}

export function validHttpUrl(value?: string | null): boolean {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; }
}
