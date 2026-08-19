import type { ArticleContentType } from "./authors.ts";

export const classifierTypes = [
  "news",
  "opinion",
  "editorial",
  "press_release",
] as const;
export const classifierFlagCodes = [
  "CONTENT_TYPE_AMBIGUITY",
  "NEWS_PRESS_RELEASE_UNCERTAINTY",
  "BILINGUAL_TYPE_DISAGREEMENT",
  "BILINGUAL_FRAMING_DIFFERENCE",
  "SOURCE_PROVENANCE_UNCLEAR",
  "ATTRIBUTION_QUALITY",
  "TRANSLATION_ALIGNMENT",
  "ARTICLE_CONTENT_MISMATCH",
  "INCOMPLETE_INPUT",
  "OTHER_EDITORIAL_REVIEW",
] as const;
export const classifierSchemaVersion = "2.0";
export const classifierPromptVersion = "content-type-bilingual-safety-v4";
export type ClassifierType = (typeof classifierTypes)[number];
export type ClassifierFlagCode = (typeof classifierFlagCodes)[number];
export type ClassifierFlag = { code: ClassifierFlagCode; message: string };
export type LanguageRecommendation = {
  en: ClassifierType | null;
  dv: ClassifierType | null;
};
export type ClassifierResult = {
  schemaVersion: typeof classifierSchemaVersion;
  recommendedType: ClassifierType;
  confidence: number;
  reason: string;
  needsHumanReview: boolean;
  flags: ClassifierFlag[];
  languageRecommendations: LanguageRecommendation;
};
export type ClassifierStory = {
  storyId: string;
  category: string | null;
  translations: Array<{
    id: string;
    language: "en" | "dv";
    headline: string;
    summary: string;
    articleText: string;
    contentType: ArticleContentType | null;
    publishedAt: number;
    articlePublishedAt: number;
    authors: Array<{
      kind: string;
      nameEn: string | null;
      nameDv: string | null;
    }>;
  }>;
};
export interface ContentTypeClassifierProvider {
  provider: string;
  model: string;
  classify(story: ClassifierStory): Promise<unknown>;
}

const mandatoryReviewCodes = new Set<ClassifierFlagCode>([
  "CONTENT_TYPE_AMBIGUITY",
  "NEWS_PRESS_RELEASE_UNCERTAINTY",
  "BILINGUAL_TYPE_DISAGREEMENT",
  "ARTICLE_CONTENT_MISMATCH",
  "INCOMPLETE_INPUT",
]);
function isType(value: unknown): value is ClassifierType {
  return (
    typeof value === "string" &&
    classifierTypes.includes(value as ClassifierType)
  );
}
function isFlagCode(value: unknown): value is ClassifierFlagCode {
  return (
    typeof value === "string" &&
    classifierFlagCodes.includes(value as ClassifierFlagCode)
  );
}
function nullableType(value: unknown) {
  return value === null ? null : isType(value) ? value : undefined;
}
function normalizedFlag(value: unknown): ClassifierFlag | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>,
    message = typeof item.message === "string" ? item.message.trim() : "";
  return isFlagCode(item.code) && message && message.length <= 240
    ? { code: item.code, message }
    : null;
}
export function validateClassifierResult(
  value: unknown,
  context: { availableLanguages?: Array<"en" | "dv"> } = {},
): ClassifierResult {
  if (!value || typeof value !== "object")
    throw new Error("Classifier returned an invalid result");
  const item = value as Record<string, unknown>,
    confidence = Number(item.confidence),
    reason = typeof item.reason === "string" ? item.reason.trim() : "",
    rawFlags = Array.isArray(item.flags) ? item.flags : null,
    languages = item.languageRecommendations as Record<string, unknown> | null;
  const en = nullableType(languages?.en),
    dv = nullableType(languages?.dv),
    flags = rawFlags?.map(normalizedFlag) ?? null;
  if (
    item.schemaVersion !== classifierSchemaVersion ||
    !isType(item.recommendedType) ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1 ||
    !reason ||
    reason.length > 500 ||
    !flags ||
    flags.some((flag) => flag === null) ||
    en === undefined ||
    dv === undefined
  )
    throw new Error("Classifier returned an invalid structured result");
  const typedFlags = flags as ClassifierFlag[],
    availableLanguages = [...new Set(context.availableLanguages ?? [])],
    disagreement = Boolean(en && dv && en !== dv);
  if (
    disagreement &&
    !typedFlags.some((flag) => flag.code === "BILINGUAL_TYPE_DISAGREEMENT")
  )
    typedFlags.push({
      code: "BILINGUAL_TYPE_DISAGREEMENT",
      message:
        "The English and Dhivehi translations received different content-type recommendations.",
    });
  for (const language of availableLanguages) {
    if ((language === "en" ? en : dv) !== null) continue;
    if (!typedFlags.some((flag) => flag.code === "INCOMPLETE_INPUT"))
      typedFlags.push({
        code: "INCOMPLETE_INPUT",
        message: `The published ${language.toUpperCase()} article did not receive a language-level recommendation.`,
      });
  }
  const deduplicated = [
    ...new Map(typedFlags.map((flag) => [flag.code, flag])).values(),
  ];
  // The top-level recommendation remains a CMS summary. For bilingual input,
  // translation-level recommendations are authoritative for approval safety.
  const bilingualLanguageFailure =
    availableLanguages.length > 1 &&
    availableLanguages.some(
      (language) => (language === "en" ? en : dv) !== "news",
    );
  const needsHumanReview =
    confidence < 0.95 ||
    item.recommendedType !== "news" ||
    bilingualLanguageFailure ||
    deduplicated.some((flag) => mandatoryReviewCodes.has(flag.code));
  return {
    schemaVersion: classifierSchemaVersion,
    recommendedType: item.recommendedType,
    confidence,
    reason,
    needsHumanReview,
    flags: deduplicated,
    languageRecommendations: { en, dv },
  };
}

function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const item = node as { type?: string; text?: string; content?: unknown[] };
  if (item.type === "text") return item.text ?? "";
  if (item.type === "hardBreak") return "\n";
  return (item.content ?? []).map(nodeText).join("");
}
export function articleText(content: string): string {
  const parsed = JSON.parse(content) as { content?: unknown[] };
  return (parsed.content ?? [])
    .map(nodeText)
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
export function classifierConfigurationPrefix(model: string) {
  return `${classifierPromptVersion}:${classifierSchemaVersion}:${model}:`;
}
export async function contentFingerprint(
  story: ClassifierStory,
  model: string,
) {
  const stable = JSON.stringify(
    story.translations
      .map((t) => ({
        language: t.language,
        headline: t.headline,
        summary: t.summary,
        articleText: t.articleText,
      }))
      .sort((a, b) => a.language.localeCompare(b.language)),
  );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(stable),
  );
  return (
    classifierConfigurationPrefix(model) +
    [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
  );
}

export async function loadClassifierStory(
  db: D1Database,
  storyId: string,
): Promise<ClassifierStory | null> {
  const rows = await db
    .prepare(
      `SELECT c.id AS storyId,cat.slug AS category,t.id,t.language,t.headline,t.summary,t.article_content AS articleContent,t.content_type AS contentType,t.published_at AS publishedAt,t.article_published_at AS articlePublishedAt,
    COALESCE((SELECT json_group_array(json_object('kind',a.kind,'nameEn',a.name_en,'nameDv',a.name_dv)) FROM article_credits ac JOIN authors a ON a.id=ac.author_id WHERE ac.translation_id=t.id AND ac.role='author'),'[]') AS authors
    FROM news_cards c JOIN news_card_translations t ON t.card_id=c.id LEFT JOIN categories cat ON cat.id=c.category_id
    WHERE c.id=? AND c.status='published' AND t.review_status='published' AND t.article_status='published' AND t.article_content IS NOT NULL AND t.article_published_at IS NOT NULL AND t.language IN ('en','dv') ORDER BY t.language`,
    )
    .bind(storyId)
    .all<Record<string, unknown>>();
  if (!rows.results.length) return null;
  return {
    storyId,
    category: (rows.results[0].category as string | null) ?? null,
    translations: rows.results.map((row) => ({
      id: String(row.id),
      language: row.language as "en" | "dv",
      headline: String(row.headline),
      summary: String(row.summary),
      articleText: articleText(String(row.articleContent)),
      contentType: (row.contentType as ArticleContentType | null) ?? null,
      publishedAt: Number(row.publishedAt),
      articlePublishedAt: Number(row.articlePublishedAt),
      authors: JSON.parse(String(row.authors ?? "[]")),
    })),
  };
}

export async function analyzeClassifierStory(
  db: D1Database,
  provider: ContentTypeClassifierProvider,
  storyId: string,
  {
    force = false,
    allowClassified = false,
  }: { force?: boolean; allowClassified?: boolean } = {},
) {
  const story = await loadClassifierStory(db, storyId);
  if (!story) throw new Error("Published detailed story not found");
  if (
    !allowClassified &&
    !story.translations.some((item) => item.contentType === null)
  )
    throw new Error("Story has no unclassified published translation");
  const fingerprint = await contentFingerprint(story, provider.model);
  if (!force) {
    const cached = await db
      .prepare(
        "SELECT * FROM content_type_recommendations WHERE story_id=? AND content_fingerprint=?",
      )
      .bind(storyId, fingerprint)
      .first<Record<string, unknown>>();
    if (cached) return recommendationRow(cached, true);
  }
  const result = validateClassifierResult(await provider.classify(story), {
      availableLanguages: story.translations.map((item) => item.language),
    }),
    now = Date.now();
  await db
    .prepare(
      `INSERT INTO content_type_recommendations(story_id,content_fingerprint,recommended_type,confidence,reason,needs_human_review,flags,language_recommendations,provider,model,generated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(story_id) DO UPDATE SET content_fingerprint=excluded.content_fingerprint,recommended_type=excluded.recommended_type,confidence=excluded.confidence,reason=excluded.reason,needs_human_review=excluded.needs_human_review,flags=excluded.flags,language_recommendations=excluded.language_recommendations,provider=excluded.provider,model=excluded.model,generated_at=excluded.generated_at`,
    )
    .bind(
      storyId,
      fingerprint,
      result.recommendedType,
      result.confidence,
      result.reason,
      result.needsHumanReview ? 1 : 0,
      JSON.stringify(result.flags),
      JSON.stringify(result.languageRecommendations),
      provider.provider,
      provider.model,
      now,
    )
    .run();
  return {
    ...result,
    storyId,
    fingerprint,
    promptVersion: classifierPromptVersion,
    provider: provider.provider,
    model: provider.model,
    generatedAt: now,
    cached: false,
  };
}

function storedFlags(value: unknown): ClassifierFlag[] {
  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((flag) =>
        typeof flag === "string"
          ? { code: "OTHER_EDITORIAL_REVIEW" as const, message: flag }
          : normalizedFlag(flag),
      )
      .filter((flag): flag is ClassifierFlag => Boolean(flag));
  } catch {
    return [];
  }
}
export function recommendationRow(
  row: Record<string, unknown>,
  cached = false,
) {
  const fingerprint = String(row.content_fingerprint),
    configurationCurrent = fingerprint.startsWith(
      classifierConfigurationPrefix(String(row.model)),
    );
  return {
    storyId: String(row.story_id),
    fingerprint,
    recommendedType: row.recommended_type as ClassifierType,
    confidence: Number(row.confidence),
    reason: String(row.reason),
    needsHumanReview: Boolean(row.needs_human_review),
    flags: storedFlags(row.flags),
    languageRecommendations: JSON.parse(String(row.language_recommendations)),
    provider: String(row.provider),
    model: String(row.model),
    generatedAt: Number(row.generated_at),
    cached,
    configurationCurrent,
    schemaVersion: configurationCurrent ? classifierSchemaVersion : null,
    promptVersion: configurationCurrent ? classifierPromptVersion : null,
  };
}
