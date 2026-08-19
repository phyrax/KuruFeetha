import benchmarkData from "../../benchmarks/content-type-balanced-v1.json" with {
  type: "json",
};
import {
  classifierTypes,
  validateClassifierResult,
  type ClassifierFlagCode,
  type ClassifierResult,
  type ClassifierStory,
  type ClassifierType,
  type ContentTypeClassifierProvider,
} from "./content-type-classifier.ts";

export const benchmarkThresholds = [0.95, 0.93, 0.92, 0.9, 0.85] as const;
const thresholdBlockingFlags = new Set<ClassifierFlagCode>([
  "CONTENT_TYPE_AMBIGUITY",
  "NEWS_PRESS_RELEASE_UNCERTAINTY",
  "BILINGUAL_TYPE_DISAGREEMENT",
  "INCOMPLETE_INPUT",
]);

type BenchmarkLanguage = "en" | "dv";
type BenchmarkTranslation = {
  language: BenchmarkLanguage;
  headline: string;
  summary: string;
  articleText: string;
};
export type BenchmarkCase = {
  benchmarkId: string;
  source: "trusted_production_snapshot" | "synthetic";
  productionStoryId?: string;
  expectedType: ClassifierType;
  expectedLanguageRecommendations: Record<BenchmarkLanguage, ClassifierType | null>;
  clarity: "clear" | "ambiguous";
  humanReviewShouldBeRequired: boolean;
  rationale: string;
  category: string | null;
  translations: BenchmarkTranslation[];
};
export type BenchmarkCaseResult = {
  benchmarkId: string;
  expectedType: ClassifierType;
  expectedLanguageRecommendations: Record<BenchmarkLanguage, ClassifierType | null>;
  clarity: "clear" | "ambiguous";
  humanReviewShouldBeRequired: boolean;
  rationale: string;
  source: BenchmarkCase["source"];
  recommendation: ClassifierResult;
  requestId: string | null;
  latencyMs: number;
};

export const balancedBenchmark = benchmarkData as {
  version: string;
  createdAt: string;
  promptVersion: string;
  schemaVersion: string;
  model: string;
  description: string;
  cases: BenchmarkCase[];
};

export function benchmarkStory(item: BenchmarkCase): ClassifierStory {
  return {
    storyId: `benchmark:${item.benchmarkId}`,
    category: item.category,
    translations: item.translations.map((translation, index) => ({
      id: `benchmark:${item.benchmarkId}:${translation.language}`,
      language: translation.language,
      headline: translation.headline,
      summary: translation.summary,
      articleText: translation.articleText,
      contentType: null,
      publishedAt: index + 1,
      articlePublishedAt: index + 1,
      authors: [],
    })),
  };
}

function ratio(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : null;
}
function numericSummary(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b),
    middle = Math.floor(ordered.length / 2);
  return {
    minimum: ordered[0] ?? null,
    maximum: ordered.at(-1) ?? null,
    mean: values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null,
    median: values.length
      ? ordered.length % 2
        ? ordered[middle]
        : (ordered[middle - 1] + ordered[middle]) / 2
      : null,
  };
}

const expectedFlagRules: Record<
  string,
  { expected?: ClassifierFlagCode[]; forbidden?: ClassifierFlagCode[] }
> = {
  "boundary-government-announcement": {
    expected: ["NEWS_PRESS_RELEASE_UNCERTAINTY"],
  },
  "boundary-corporate-light-rewrite": {
    expected: ["NEWS_PRESS_RELEASE_UNCERTAINTY"],
  },
  "boundary-bilingual-framing": {
    expected: ["BILINGUAL_FRAMING_DIFFERENCE"],
    forbidden: ["BILINGUAL_TYPE_DISAGREEMENT"],
  },
  "boundary-bilingual-different-types": {
    expected: ["BILINGUAL_TYPE_DISAGREEMENT"],
  },
};

export function evaluateBenchmark(results: BenchmarkCaseResult[]) {
  const confusionMatrix = Object.fromEntries(
    classifierTypes.map((gold) => [
      gold,
      Object.fromEntries(classifierTypes.map((predicted) => [predicted, 0])),
    ]),
  ) as Record<ClassifierType, Record<ClassifierType, number>>;
  for (const item of results)
    confusionMatrix[item.expectedType][item.recommendation.recommendedType]++;

  const perType = Object.fromEntries(
    classifierTypes.map((type) => {
      const truePositive = confusionMatrix[type][type],
        predicted = results.filter(
          (item) => item.recommendation.recommendedType === type,
        ).length,
        actual = results.filter((item) => item.expectedType === type).length,
        precision = ratio(truePositive, predicted),
        recall = ratio(truePositive, actual);
      return [
        type,
        {
          precision,
          recall,
          f1:
            precision !== null && recall !== null && precision + recall
              ? (2 * precision * recall) / (precision + recall)
              : null,
          support: actual,
        },
      ];
    }),
  );
  const genuineNews = results.filter(
      (item) =>
        item.expectedType === "news" &&
        Object.values(item.expectedLanguageRecommendations)
          .filter((type): type is ClassifierType => type !== null)
          .every((type) => type === "news"),
    ),
    thresholds = Object.fromEntries(
      benchmarkThresholds.map((threshold) => {
        const approved = results.filter(
            (item) =>
              item.recommendation.recommendedType === "news" &&
              item.recommendation.confidence >= threshold &&
              !item.recommendation.flags.some((flag) =>
                thresholdBlockingFlags.has(flag.code),
              ),
          ),
          trueNews = approved.filter((item) => genuineNews.includes(item)),
          falseNews = approved.filter((item) => !genuineNews.includes(item));
        return [
          threshold.toFixed(2),
          {
            newsPrecision: ratio(trueNews.length, approved.length),
            newsCoverage: ratio(trueNews.length, genuineNews.length),
            qualifyingNews: approved.length,
            falseNewsApprovals: falseNews.map((item) => ({
              benchmarkId: item.benchmarkId,
              expectedType: item.expectedType,
              expectedLanguageRecommendations:
                item.expectedLanguageRecommendations,
            })),
            manualReviewLoad: results.length - approved.length,
          },
        ];
      }),
    ),
    falseNewsClassifications = results
      .filter(
        (item) =>
          item.expectedType !== "news" &&
          item.recommendation.recommendedType === "news",
      )
      .map((item) => ({
        benchmarkId: item.benchmarkId,
        expectedType: item.expectedType,
        confidence: item.recommendation.confidence,
        needsHumanReview: item.recommendation.needsHumanReview,
        flags: item.recommendation.flags,
      }));
  const confidenceByTrueClass = Object.fromEntries(
      classifierTypes.map((type) => [
        type,
        numericSummary(
          results
            .filter((item) => item.expectedType === type)
            .map((item) => item.recommendation.confidence),
        ),
      ]),
    ),
    confidenceByClarity = Object.fromEntries(
      (["clear", "ambiguous"] as const).map((clarity) => [
        clarity,
        numericSummary(
          results
            .filter((item) => item.clarity === clarity)
            .map((item) => item.recommendation.confidence),
        ),
      ]),
    );
  const flagPerformance = results.map((item) => {
    const actual = item.recommendation.flags.map((flag) => flag.code),
      rules = expectedFlagRules[item.benchmarkId] ?? {},
      missing = (rules.expected ?? []).filter((code) => !actual.includes(code)),
      unnecessary = (rules.forbidden ?? []).filter((code) =>
        actual.includes(code),
      );
    return {
      benchmarkId: item.benchmarkId,
      actual,
      missing,
      unnecessary,
      appropriate: missing.length === 0 && unnecessary.length === 0,
    };
  });
  const bilingual = results
    .filter(
      (item) =>
        item.expectedLanguageRecommendations.en &&
        item.expectedLanguageRecommendations.dv,
    )
    .map((item) => ({
      benchmarkId: item.benchmarkId,
      expected: item.expectedLanguageRecommendations,
      actual: item.recommendation.languageRecommendations,
      correct:
        item.expectedLanguageRecommendations.en ===
          item.recommendation.languageRecommendations.en &&
        item.expectedLanguageRecommendations.dv ===
          item.recommendation.languageRecommendations.dv,
    }));
  return {
    cases: results.length,
    confusionMatrix,
    overallAccuracy: ratio(
      results.filter(
        (item) =>
          item.expectedType === item.recommendation.recommendedType,
      ).length,
      results.length,
    ),
    perType,
    thresholds,
    falseNewsClassifications,
    confidenceByTrueClass,
    confidenceByClarity,
    flagPerformance,
    bilingual,
    latency: numericSummary(results.map((item) => item.latencyMs)),
  };
}

export async function runBalancedBenchmark(
  provider: ContentTypeClassifierProvider & { lastRequestId?: string | null },
  onResult?: (result: BenchmarkCaseResult) => void,
) {
  const results: BenchmarkCaseResult[] = [];
  for (const item of balancedBenchmark.cases) {
    const started = Date.now(),
      recommendation = validateClassifierResult(
        await provider.classify(benchmarkStory(item)),
      ),
      result = {
        benchmarkId: item.benchmarkId,
        expectedType: item.expectedType,
        expectedLanguageRecommendations: item.expectedLanguageRecommendations,
        clarity: item.clarity,
        humanReviewShouldBeRequired: item.humanReviewShouldBeRequired,
        rationale: item.rationale,
        source: item.source,
        recommendation,
        requestId: provider.lastRequestId ?? null,
        latencyMs: Date.now() - started,
      } satisfies BenchmarkCaseResult;
    results.push(result);
    onResult?.(result);
  }
  return { results, evaluation: evaluateBenchmark(results) };
}
