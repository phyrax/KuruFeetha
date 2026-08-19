import { isStreamlinedNewsEligible } from "./classification-eligibility.ts";

export const humanReviewBatchBlockers = new Set([
  "BILINGUAL_TYPE_DISAGREEMENT",
  "NEWS_PRESS_RELEASE_UNCERTAINTY",
  "ARTICLE_CONTENT_MISMATCH",
  "INCOMPLETE_INPUT",
]);

export const specialReviewStoryIds = new Set([
  "bf0379b1-4f67-43e3-a3f8-14060dda0a3a",
  "f198c303-3a3a-4265-b0aa-86e68e33d6ab",
]);

export const preferredFirstReviewStoryIds = [
  "01118f65-3f19-4348-85f1-f9d05d409b51",
  "7a70b520-ff58-426b-a60e-57fa50091686",
  "e0e0dab4-0750-4467-bfd1-d7323f6fb6d2",
  "f1e01752-32c1-4913-b712-3b5522c6b808",
  "f0e01d8a-603b-4ad4-b16b-b252ce58cdb5",
] as const;

type Translation = { language: "en" | "dv"; contentType?: string | null };
type Recommendation = {
  recommendedType: string;
  confidence: number;
  needsHumanReview: boolean;
  flags: Array<{ code: string }>;
  languageRecommendations: { en: string | null; dv: string | null };
};

export function isHumanReviewNewsEligible(
  translations: Translation[],
  recommendation: Recommendation | null | undefined,
) {
  if (
    !recommendation ||
    recommendation.recommendedType !== "news" ||
    !translations.some(({ contentType }) => contentType === null) ||
    isStreamlinedNewsEligible(translations, recommendation)
  )
    return false;
  const languages = [...new Set(translations.map(({ language }) => language))];
  return (
    languages.length > 0 &&
    languages.every(
      (language) => recommendation.languageRecommendations[language] === "news",
    )
  );
}

export function humanReviewBatchBlockReason(
  storyId: string,
  recommendation: Recommendation,
) {
  if (specialReviewStoryIds.has(storyId)) return "SPECIAL_ARTICLE_PAIR_REVIEW";
  return (
    recommendation.flags.find(({ code }) => humanReviewBatchBlockers.has(code))
      ?.code ?? null
  );
}

export function canEnterHumanReviewedBatch(
  storyId: string,
  translations: Translation[],
  recommendation: Recommendation | null | undefined,
  reviewed: boolean,
  stale = false,
) {
  return Boolean(
    reviewed &&
      !stale &&
      recommendation &&
      isHumanReviewNewsEligible(translations, recommendation) &&
      !humanReviewBatchBlockReason(storyId, recommendation),
  );
}
