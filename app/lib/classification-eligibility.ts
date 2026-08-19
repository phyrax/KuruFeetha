import type {
  ClassifierType,
  LanguageRecommendation,
} from "./content-type-classifier.ts";

type StreamlinedRecommendation = {
  recommendedType: ClassifierType;
  confidence: number;
  needsHumanReview: boolean;
  languageRecommendations: LanguageRecommendation;
};

export function isStreamlinedNewsEligible(
  translations: Array<{ language: "en" | "dv" }>,
  recommendation: StreamlinedRecommendation | null | undefined,
) {
  if (
    !recommendation ||
    recommendation.recommendedType !== "news" ||
    recommendation.confidence < 0.95 ||
    recommendation.needsHumanReview
  )
    return false;

  const available = [...new Set(translations.map(({ language }) => language))];
  return (
    available.length > 0 &&
    available.every(
      (language) => recommendation.languageRecommendations[language] === "news",
    )
  );
}
