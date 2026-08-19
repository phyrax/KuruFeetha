import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  balancedBenchmark,
  benchmarkStory,
  evaluateBenchmark,
  runBalancedBenchmark,
} from "../app/lib/content-type-benchmark.ts";
import { classifierSchemaVersion } from "../app/lib/content-type-classifier.ts";

const structured = (type, confidence, languageRecommendations, flags = []) => ({
  schemaVersion: classifierSchemaVersion,
  recommendedType: type,
  confidence,
  reason: "Fixture result for deterministic benchmark evaluation.",
  needsHumanReview: false,
  flags,
  languageRecommendations,
});

test("versioned balanced gold dataset has complete authoritative labels and bodies", () => {
  assert.equal(balancedBenchmark.version, "content-type-balanced-v1");
  assert.equal(balancedBenchmark.model, "gpt-5.4-nano");
  assert.equal(balancedBenchmark.promptVersion, "content-type-confidence-v2");
  assert.equal(balancedBenchmark.schemaVersion, "2.0");
  assert.ok(balancedBenchmark.cases.length >= 30);
  const byType = Object.groupBy(
    balancedBenchmark.cases,
    (item) => item.expectedType,
  );
  assert.ok(byType.news.length >= 8);
  assert.ok(byType.opinion.length >= 5);
  assert.ok(byType.editorial.length >= 5);
  assert.ok(byType.press_release.length >= 5);
  assert.ok(
    balancedBenchmark.cases.filter((item) => item.clarity === "ambiguous")
      .length >= 8,
  );
  assert.equal(
    balancedBenchmark.cases.filter(
      (item) => item.source === "trusted_production_snapshot",
    ).length,
    5,
  );
  for (const item of balancedBenchmark.cases) {
    assert.ok(item.benchmarkId);
    assert.ok(item.rationale);
    assert.ok(["clear", "ambiguous"].includes(item.clarity));
    assert.equal(typeof item.humanReviewShouldBeRequired, "boolean");
    assert.ok(item.translations.length);
    for (const translation of item.translations) {
      assert.ok(translation.headline.trim());
      assert.ok(translation.summary.trim());
      assert.ok(translation.articleText.trim().split(/\s+/u).length >= 20);
    }
  }
});

test("benchmark stories are test-only classifier inputs with no editorial identity", () => {
  const item = balancedBenchmark.cases[0],
    story = benchmarkStory(item);
  assert.equal(story.storyId, `benchmark:${item.benchmarkId}`);
  assert.ok(story.translations.every((translation) => translation.contentType === null));
  assert.ok(story.translations.every((translation) => translation.authors.length === 0));
  assert.ok(story.translations.every((translation) => translation.articleText.length > 0));
});

test("benchmark runner uses provider classify and does not require a database", async () => {
  let calls = 0;
  const provider = {
    provider: "fixture",
    model: "gpt-5.4-nano",
    lastRequestId: null,
    async classify(story) {
      calls++;
      this.lastRequestId = `request-${calls}`;
      const item = balancedBenchmark.cases.find(
        (candidate) => `benchmark:${candidate.benchmarkId}` === story.storyId,
      );
      return structured(
        item.expectedType,
        item.clarity === "clear" ? 0.97 : 0.85,
        item.expectedLanguageRecommendations,
        item.benchmarkId === "boundary-bilingual-different-types"
          ? [
              {
                code: "BILINGUAL_TYPE_DISAGREEMENT",
                message: "The formats genuinely differ by language.",
              },
            ]
          : [],
      );
    },
  };
  const report = await runBalancedBenchmark(provider);
  assert.equal(calls, balancedBenchmark.cases.length);
  assert.equal(report.results.length, balancedBenchmark.cases.length);
  assert.equal(report.evaluation.overallAccuracy, 1);
  assert.ok(report.results.every((item) => item.requestId));
});

test("evaluation reports confusion, false News and threshold precision", () => {
  const cases = [
    {
      benchmarkId: "true-news",
      expectedType: "news",
      expectedLanguageRecommendations: { en: "news", dv: null },
      clarity: "clear",
      humanReviewShouldBeRequired: false,
      rationale: "gold",
      source: "synthetic",
      requestId: "one",
      latencyMs: 10,
      recommendation: structured("news", 0.96, { en: "news", dv: null }),
    },
    {
      benchmarkId: "false-news",
      expectedType: "press_release",
      expectedLanguageRecommendations: { en: "press_release", dv: null },
      clarity: "ambiguous",
      humanReviewShouldBeRequired: true,
      rationale: "gold",
      source: "synthetic",
      requestId: "two",
      latencyMs: 20,
      recommendation: structured("news", 0.94, { en: "news", dv: null }),
    },
  ];
  const report = evaluateBenchmark(cases);
  assert.equal(report.confusionMatrix.news.news, 1);
  assert.equal(report.confusionMatrix.press_release.news, 1);
  assert.equal(report.overallAccuracy, 0.5);
  assert.equal(report.thresholds["0.95"].newsPrecision, 1);
  assert.deepEqual(report.thresholds["0.93"].falseNewsApprovals, ["false-news"]);
  assert.deepEqual(report.falseNewsClassifications.map((item) => item.benchmarkId), ["false-news"]);
});

test("production benchmark route is admin-only and cannot write editorial or recommendation data", async () => {
  const route = await readFile(
    new URL(
      "../app/api/v1/admin/content-classification/benchmark/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(route, /requireAdmin\(request\)/);
  assert.match(route, /runBalancedBenchmark/);
  assert.doesNotMatch(
    route,
    /analyzeClassifierStory|content_type_recommendations|UPDATE\s+news_card_translations|updateContentTypeOnly|method:\s*["']PATCH/i,
  );
  assert.doesNotMatch(route, /Analyze All|Bulk Approve/i);
});
