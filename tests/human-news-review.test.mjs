import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canEnterHumanReviewedBatch,
  humanReviewBatchBlockReason,
  isHumanReviewNewsEligible,
  preferredFirstReviewStoryIds,
} from "../app/lib/human-news-review.ts";

const translations = [
  { language: "en", contentType: null },
  { language: "dv", contentType: null },
];
const recommendation = {
  recommendedType: "news",
  confidence: 0.93,
  needsHumanReview: false,
  flags: [],
  languageRecommendations: { en: "news", dv: "news" },
};

test("sub-0.95 agreed News belongs only to human review", () => {
  assert.equal(isHumanReviewNewsEligible(translations, recommendation), true);
  assert.equal(canEnterHumanReviewedBatch("clean", translations, recommendation, false), false);
  assert.equal(canEnterHumanReviewedBatch("clean", translations, recommendation, true), true);
});

test("special stories and safety flags cannot enter multi-story approval", () => {
  for (const id of ["bf0379b1-4f67-43e3-a3f8-14060dda0a3a", "f198c303-3a3a-4265-b0aa-86e68e33d6ab"])
    assert.equal(canEnterHumanReviewedBatch(id, translations, recommendation, true), false);
  for (const code of ["BILINGUAL_TYPE_DISAGREEMENT", "NEWS_PRESS_RELEASE_UNCERTAINTY", "ARTICLE_CONTENT_MISMATCH", "INCOMPLETE_INPUT"]) {
    const flagged = { ...recommendation, flags: [{ code }] };
    assert.equal(humanReviewBatchBlockReason("clean", flagged), code);
    assert.equal(canEnterHumanReviewedBatch("clean", translations, flagged, true), false);
  }
});

test("missing or disagreeing language recommendation is excluded", () => {
  assert.equal(isHumanReviewNewsEligible(translations, { ...recommendation, languageRecommendations: { en: "news", dv: null } }), false);
  assert.equal(isHumanReviewNewsEligible(translations, { ...recommendation, languageRecommendations: { en: "news", dv: "opinion" } }), false);
});

test("streamlined 0.95 lane remains separate", () => {
  assert.equal(isHumanReviewNewsEligible(translations, { ...recommendation, confidence: 0.95 }), false);
});

test("workflow starts empty and uses the safe endpoint per translation", async () => {
  const source = await readFile(new URL("../app/components/ContentClassificationWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /useState<Set<string>>\(new Set\(\)\)/);
  assert.match(source, /Reviewed — approve as News/);
  assert.match(source, /for \(const translation of item\.translations\.filter/);
  assert.match(source, /\/api\/v1\/admin\/cards\/\$\{item\.storyId\}\/content-type/);
  assert.match(source, /expectedContentType: null/);
  assert.match(source, /response\.status === 409/);
  assert.doesNotMatch(source, /Save story/);
});

test("first review batch is explicit and contains five unapproved candidates", () => {
  assert.equal(preferredFirstReviewStoryIds.length, 5);
  assert.deepEqual(preferredFirstReviewStoryIds.slice(0, 4), [
    "01118f65-3f19-4348-85f1-f9d05d409b51",
    "7a70b520-ff58-426b-a60e-57fa50091686",
    "e0e0dab4-0750-4467-bfd1-d7323f6fb6d2",
    "f1e01752-32c1-4913-b712-3b5522c6b808",
  ]);
});
