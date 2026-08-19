import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  analyzeClassifierStory,
  classifierPromptVersion,
  classifierSchemaVersion,
  contentFingerprint,
  loadClassifierStory,
  validateClassifierResult,
} from "../app/lib/content-type-classifier.ts";
import { isStreamlinedNewsEligible } from "../app/lib/classification-eligibility.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
class Statement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.values = [];
  }
  bind(...values) {
    this.values = values;
    return this;
  }
  async first() {
    return this.db.prepare(this.sql).get(...this.values) ?? null;
  }
  async all() {
    return { results: this.db.prepare(this.sql).all(...this.values) };
  }
  async run() {
    return this.db.prepare(this.sql).run(...this.values);
  }
}
class TestDatabase {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec(
      `CREATE TABLE categories(id TEXT PRIMARY KEY,slug TEXT);CREATE TABLE news_cards(id TEXT PRIMARY KEY,status TEXT,category_id TEXT,published_at INTEGER,updated_at INTEGER);CREATE TABLE news_card_translations(id TEXT PRIMARY KEY,card_id TEXT,language TEXT,headline TEXT,summary TEXT,article_content TEXT,content_type TEXT,review_status TEXT,published_at INTEGER,article_status TEXT,article_published_at INTEGER,updated_at INTEGER);CREATE TABLE authors(id TEXT PRIMARY KEY,kind TEXT,name_en TEXT,name_dv TEXT);CREATE TABLE article_credits(id TEXT,translation_id TEXT,author_id TEXT,role TEXT,sort_order INTEGER);CREATE TABLE content_type_recommendations(story_id TEXT PRIMARY KEY,content_fingerprint TEXT,recommended_type TEXT,confidence REAL,reason TEXT,needs_human_review INTEGER,flags TEXT,language_recommendations TEXT,provider TEXT,model TEXT,generated_at INTEGER);INSERT INTO categories VALUES('cat','maldives');INSERT INTO news_cards VALUES('story','published','cat',1000,1100);INSERT INTO news_card_translations VALUES('en','story','en','Council approves budget','The council approved its annual budget.','{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"The council voted on Tuesday to approve its annual budget after a public meeting."}]}]}',NULL,'published',2000,'published',3000,3100);INSERT INTO news_card_translations VALUES('dv','story','dv','ކައުންސިލުން ބަޖެޓު ފާސްކޮށްފި','ކައުންސިލުން އަހަރީ ބަޖެޓު ފާސްކޮށްފިއެވެ.','{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"ކައުންސިލުން އަންގާރަ ދުވަހު ބައްދަލުވެ ބަޖެޓު ފާސްކުރިއެވެ."}]}]}',NULL,'published',2001,'published',3001,3101);`,
    );
  }
  prepare(sql) {
    return new Statement(this.sqlite, sql);
  }
}

const result = (recommendedType, confidence = 0.98, extra = {}) => ({
  schemaVersion: classifierSchemaVersion,
  recommendedType,
  confidence,
  reason:
    "Classification is based on the complete article's journalistic form.",
  needsHumanReview: false,
  flags: [],
  languageRecommendations: { en: recommendedType, dv: recommendedType },
  ...extra,
});

test("accepts only the four structured classifications and rejects malformed output", () => {
  for (const type of ["news", "opinion", "editorial", "press_release"])
    assert.equal(validateClassifierResult(result(type)).recommendedType, type);
  for (const invalid of [
    null,
    {},
    result("review"),
    { ...result("news"), confidence: 2 },
    { ...result("news"), reason: "" },
  ])
    assert.throws(() => validateClassifierResult(invalid), /invalid/);
});

test("mandatory review policy uses confidence, sensitive formats and stable flag codes", () => {
  assert.equal(
    validateClassifierResult(result("news", 0.95)).needsHumanReview,
    false,
  );
  assert.equal(
    validateClassifierResult(result("news", 0.949)).needsHumanReview,
    true,
  );
  for (const type of ["opinion", "editorial", "press_release"])
    assert.equal(validateClassifierResult(result(type)).needsHumanReview, true);
  const disagreement = validateClassifierResult(
    result("news", 0.99, {
      languageRecommendations: { en: "news", dv: "opinion" },
    }),
  );
  assert.equal(disagreement.needsHumanReview, true);
  assert.ok(
    disagreement.flags.some(
      (flag) => flag.code === "BILINGUAL_TYPE_DISAGREEMENT",
    ),
  );
  assert.equal(
    validateClassifierResult(
      result("news", 0.99, {
        flags: [
          {
            code: "NEWS_PRESS_RELEASE_UNCERTAINTY",
            message: "Both formats remain plausible.",
          },
        ],
      }),
    ).needsHumanReview,
    true,
  );
});

test("quality-only flags do not force review when content type is unmistakable", () => {
  for (const code of [
    "SOURCE_PROVENANCE_UNCLEAR",
    "ATTRIBUTION_QUALITY",
    "TRANSLATION_ALIGNMENT",
    "BILINGUAL_FRAMING_DIFFERENCE",
  ]) {
    const value = validateClassifierResult(
      result("news", 0.97, {
        needsHumanReview: true,
        flags: [{ code, message: "Editorial quality follow-up." }],
      }),
    );
    assert.equal(value.needsHumanReview, false, code);
  }
});

test("bilingual approval requires every published language to be News", () => {
  const translations = [{ language: "en" }, { language: "dv" }];
  const bothNews = validateClassifierResult(result("news", 0.97), {
    availableLanguages: ["en", "dv"],
  });
  assert.equal(bothNews.needsHumanReview, false);
  assert.equal(isStreamlinedNewsEligible(translations, bothNews), true);

  for (const [en, dv] of [
    ["news", "press_release"],
    ["opinion", "news"],
    ["editorial", "news"],
  ]) {
    const mixed = validateClassifierResult(
      result("news", 0.99, {
        languageRecommendations: { en, dv },
      }),
      { availableLanguages: ["en", "dv"] },
    );
    assert.equal(mixed.needsHumanReview, true, `${en}/${dv}`);
    assert.equal(isStreamlinedNewsEligible(translations, mixed), false);
    assert.ok(
      mixed.flags.some((flag) => flag.code === "BILINGUAL_TYPE_DISAGREEMENT"),
    );
  }
});

test("missing recommendation for an available translation is incomplete and ineligible", () => {
  const value = validateClassifierResult(
    result("news", 0.99, {
      languageRecommendations: { en: "news", dv: null },
    }),
    { availableLanguages: ["en", "dv"] },
  );
  assert.equal(value.needsHumanReview, true);
  assert.equal(
    value.flags.some((flag) => flag.code === "INCOMPLETE_INPUT"),
    true,
  );
  assert.equal(
    isStreamlinedNewsEligible([{ language: "en" }, { language: "dv" }], value),
    false,
  );
});

test("material mismatch and News/Press Release uncertainty are mandatory review flags", () => {
  for (const code of [
    "ARTICLE_CONTENT_MISMATCH",
    "NEWS_PRESS_RELEASE_UNCERTAINTY",
  ]) {
    const value = validateClassifierResult(
      result("news", 0.99, {
        flags: [{ code, message: "Material format review is required." }],
      }),
      { availableLanguages: ["en", "dv"] },
    );
    assert.equal(value.needsHumanReview, true, code);
  }
});

test("same-type bilingual framing differences remain eligible quality signals", () => {
  const value = validateClassifierResult(
    result("news", 0.97, {
      flags: [
        {
          code: "BILINGUAL_FRAMING_DIFFERENCE",
          message: "The emphasis differs but the journalistic type is News.",
        },
      ],
    }),
    { availableLanguages: ["en", "dv"] },
  );
  assert.equal(value.needsHumanReview, false);
  assert.equal(
    value.flags.some((flag) => flag.code === "BILINGUAL_TYPE_DISAGREEMENT"),
    false,
  );
  assert.equal(
    isStreamlinedNewsEligible([{ language: "en" }, { language: "dv" }], value),
    true,
  );
});

test("rejects legacy free-form flags, unknown codes and wrong schema versions", () => {
  assert.throws(
    () =>
      validateClassifierResult(result("news", 0.98, { flags: ["ambiguous"] })),
    /invalid/,
  );
  assert.throws(
    () =>
      validateClassifierResult(
        result("news", 0.98, {
          flags: [{ code: "NEW_CODE", message: "Unknown" }],
        }),
      ),
    /invalid/,
  );
  assert.throws(
    () =>
      validateClassifierResult(result("news", 0.98, { schemaVersion: "1.0" })),
    /invalid/,
  );
});

test("representative full-article classifier fixtures preserve the approved editorial distinctions", () => {
  const fixtures = [
    {
      article: "Neutral account of a council vote and public statements.",
      expected: "news",
    },
    {
      article:
        "A minister strongly argues for a policy, reported neutrally by KuruFeetha.",
      expected: "news",
    },
    {
      article: "A named contributor presents their own analysis and argument.",
      expected: "opinion",
    },
    {
      article: "KuruFeetha argues its institutional position.",
      expected: "editorial",
    },
    {
      article:
        "Communication supplied by an outside institution is substantially reproduced.",
      expected: "press_release",
    },
  ];
  for (const fixture of fixtures) {
    const structured = validateClassifierResult(result(fixture.expected));
    assert.equal(structured.recommendedType, fixture.expected, fixture.article);
  }
});

test("analysis reads full bilingual articles, caches separately and never mutates editorial rows", async () => {
  const db = new TestDatabase(),
    before = db.sqlite
      .prepare("SELECT * FROM news_card_translations ORDER BY id")
      .all(),
    calls = [];
  const provider = {
    provider: "fixture",
    model: "fixture-v1",
    async classify(story) {
      calls.push(story);
      return result("news");
    },
  };
  const first = await analyzeClassifierStory(db, provider, "story"),
    second = await analyzeClassifierStory(db, provider, "story");
  assert.equal(first.recommendedType, "news");
  assert.equal(second.cached, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].translations.length, 2);
  assert.match(
    calls[0].translations[0].articleText,
    /complete|council|ކައުންސިލުން/i,
  );
  assert.deepEqual(
    db.sqlite.prepare("SELECT * FROM news_card_translations ORDER BY id").all(),
    before,
  );
  assert.equal(
    db.sqlite
      .prepare("SELECT COUNT(*) count FROM content_type_recommendations")
      .get().count,
    1,
  );
});

test("content changes invalidate the recommendation fingerprint", async () => {
  const db = new TestDatabase();
  let calls = 0;
  const provider = {
    provider: "fixture",
    model: "fixture-v1",
    async classify() {
      calls++;
      return result("news");
    },
  };
  const first = await analyzeClassifierStory(db, provider, "story");
  db.sqlite
    .prepare(
      "UPDATE news_card_translations SET article_content=? WHERE id='en'",
    )
    .run(
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Changed complete article."}]}]}',
    );
  const second = await analyzeClassifierStory(db, provider, "story");
  assert.notEqual(first.fingerprint, second.fingerprint);
  assert.equal(calls, 2);
});

test("model, prompt and schema versions are part of cache identity", async () => {
  const db = new TestDatabase(),
    story = await loadClassifierStory(db, "story");
  assert.ok(story);
  const a = await contentFingerprint(story, "model-a"),
    b = await contentFingerprint(story, "model-b");
  assert.notEqual(a, b);
  assert.match(
    a,
    new RegExp(
      `^${classifierPromptVersion}:${classifierSchemaVersion}:model-a:`,
    ),
  );
  const legacy = "a".repeat(64);
  db.sqlite
    .prepare(
      "INSERT INTO content_type_recommendations VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    )
    .run(
      "story",
      legacy,
      "news",
      0.99,
      "legacy",
      0,
      "[]",
      '{"en":"news","dv":"news"}',
      "fixture",
      "model-a",
      1,
    );
  let calls = 0;
  await analyzeClassifierStory(
    db,
    {
      provider: "fixture",
      model: "model-a",
      async classify() {
        calls++;
        return result("news");
      },
    },
    "story",
  );
  assert.equal(calls, 1);
});

test("trusted calibration can analyze classified stories without changing authoritative rows", async () => {
  const db = new TestDatabase(),
    provider = {
      provider: "fixture",
      model: "fixture-v1",
      async classify() {
        return result("news");
      },
    };
  db.sqlite
    .prepare("UPDATE news_card_translations SET content_type='news'")
    .run();
  const before = db.sqlite
    .prepare("SELECT * FROM news_card_translations ORDER BY id")
    .all();
  await assert.rejects(
    () => analyzeClassifierStory(db, provider, "story"),
    /no unclassified/,
  );
  const recommendation = await analyzeClassifierStory(db, provider, "story", {
    force: true,
    allowClassified: true,
  });
  assert.equal(recommendation.recommendedType, "news");
  assert.deepEqual(
    db.sqlite.prepare("SELECT * FROM news_card_translations ORDER BY id").all(),
    before,
  );
});

test("provider prompt applies editorial definitions to full translations without auto-writing", async () => {
  const [
    provider,
    workspace,
    analyzeRoute,
    calibrationRoute,
    safeRoute,
    migration,
  ] = await Promise.all([
    read("../app/lib/openai-content-type-provider.ts"),
    read("../app/components/ContentClassificationWorkspace.tsx"),
    read("../app/api/v1/admin/content-classification/analyze/route.ts"),
    read("../app/api/v1/admin/content-classification/calibrate/route.ts"),
    read("../app/api/v1/admin/cards/[id]/content-type/route.ts"),
    read("../drizzle/0019_add_content_type_recommendations.sql"),
  ]);
  assert.match(provider, /quoted person advocates strongly/);
  assert.match(provider, /identified contributor's own argument/);
  assert.match(provider, /KuruFeetha's institutional position/);
  assert.match(provider, /supplied external communication/);
  assert.match(provider, /Never copy one language recommendation/);
  assert.match(provider, /Reserve ARTICLE_CONTENT_MISMATCH for a material/);
  assert.match(provider, /articleText/);
  assert.match(provider, /store:\s*false/);
  assert.match(analyzeRoute, /requireAdmin\(request\)/);
  assert.doesNotMatch(analyzeRoute, /updateContentTypeOnly|method:\s*"PATCH"/);
  assert.match(calibrationRoute, /requireAdmin\(request\)/);
  assert.match(calibrationRoute, /allowClassified:\s*true/);
  assert.doesNotMatch(
    calibrationRoute,
    /UPDATE\s+news_card_translations|updateContentTypeOnly|method:\s*"PATCH"/i,
  );
  assert.match(workspace, /expectedContentType:\s*null/);
  assert.match(workspace, /isStreamlinedNewsEligible/);
  assert.match(workspace, /response\.status\s*===\s*409/);
  assert.match(workspace, /selected\.has/);
  assert.match(workspace, /confirm\(/);
  assert.doesNotMatch(workspace, /Save story/);
  assert.match(safeRoute, /updateContentTypeOnly/);
  assert.doesNotMatch(migration, /UPDATE `?news_card_translations/);
});

test("recommendation migration is additive and enforces the controlled type set", async () => {
  const sql = await read(
      "../drizzle/0019_add_content_type_recommendations.sql",
    ),
    db = new DatabaseSync(":memory:");
  db.exec(
    "PRAGMA foreign_keys=ON; CREATE TABLE news_cards(id TEXT PRIMARY KEY);",
  );
  db.exec(sql);
  assert.ok(
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='content_type_recommendations'",
      )
      .get(),
  );
  db.prepare("INSERT INTO news_cards(id) VALUES('story')").run();
  assert.throws(() =>
    db
      .prepare(
        "INSERT INTO content_type_recommendations(story_id,content_fingerprint,recommended_type,confidence,reason,needs_human_review,flags,language_recommendations,provider,model,generated_at) VALUES('story','f','review',.9,'x',1,'[]','{}','p','m',1)",
      )
      .run(),
  );
});
