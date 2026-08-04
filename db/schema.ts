import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
};

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull().unique(),
  language: text("language", { enum: ["en", "dv", "both"] }).notNull(),
  ingestionMethod: text("ingestion_method", { enum: ["rss", "api", "adapter", "manual"] }).notNull(),
  feedUrl: text("feed_url"),
  pollMinutes: integer("poll_minutes").notNull().default(15),
  imageUseAllowed: integer("image_use_allowed", { mode: "boolean" }).notNull().default(false),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const sourceArticles = sqliteTable("source_articles", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => sources.id),
  canonicalUrl: text("canonical_url").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  contentHash: text("content_hash").notNull(),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  status: text("status", { enum: ["discovered", "extracted", "clustered", "failed"] }).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("source_article_url_idx").on(table.canonicalUrl)]);

export const storyClusters = sqliteTable("story_clusters", {
  id: text("id").primaryKey(),
  representativeTitle: text("representative_title").notNull(),
  status: text("status", { enum: ["open", "merged", "dismissed"] }).notNull().default("open"),
  similarity: real("similarity"),
  ...timestamps,
});

export const clusterArticles = sqliteTable("cluster_articles", {
  clusterId: text("cluster_id").notNull().references(() => storyClusters.id),
  articleId: text("article_id").notNull().references(() => sourceArticles.id),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameDv: text("name_dv").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const newsCards = sqliteTable("news_cards", {
  id: text("id").primaryKey(),
  clusterId: text("cluster_id").references(() => storyClusters.id),
  categoryId: text("category_id").references(() => categories.id),
  status: text("status", { enum: ["ai_drafting", "needs_review", "approved", "scheduled", "published", "archived"] }).notNull(),
  breaking: integer("breaking", { mode: "boolean" }).notNull().default(false),
  boost: integer("boost").notNull().default(0),
  imageUrl: text("image_url"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  ...timestamps,
});

export const newsCardTranslations = sqliteTable("news_card_translations", {
  id: text("id").primaryKey(),
  cardId: text("card_id").notNull().references(() => newsCards.id),
  language: text("language", { enum: ["en", "dv"] }).notNull(),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  wordCount: integer("word_count").notNull(),
  reviewStatus: text("review_status", { enum: ["draft", "approved", "rejected"] }).notNull().default("draft"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  ...timestamps,
}, (table) => [uniqueIndex("card_language_idx").on(table.cardId, table.language)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  authSubject: text("auth_subject").unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  role: text("role", { enum: ["reader", "admin", "owner"] }).notNull().default("reader"),
  status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
  preferredLanguage: text("preferred_language", { enum: ["en", "dv"] }).notNull().default("en"),
  onboardingCompletedAt: integer("onboarding_completed_at", { mode: "timestamp" }),
  lastActiveAt: integer("last_active_at", { mode: "timestamp" }).notNull().default(0),
  ...timestamps,
});

export const categoryFollows = sqliteTable("category_follows", {
  userId: text("user_id").notNull().references(() => users.id),
  categoryId: text("category_id").notNull().references(() => categories.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [uniqueIndex("category_follow_user_category_idx").on(table.userId, table.categoryId)]);

export const bookmarks = sqliteTable("bookmarks", {
  userId: text("user_id").notNull().references(() => users.id),
  cardId: text("card_id").notNull().references(() => newsCards.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [uniqueIndex("bookmark_user_card_idx").on(table.userId, table.cardId)]);

export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  platform: text("platform", { enum: ["web", "ios", "android"] }).notNull(),
  pushToken: text("push_token").notNull().unique(),
  language: text("language", { enum: ["en", "dv"] }).notNull().default("en"),
  topics: text("topics", { mode: "json" }).notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  sponsorName: text("sponsor_name").notNull(),
  status: text("status", { enum: ["draft", "active", "paused", "completed"] }).notNull(),
  startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp" }).notNull(),
  frequencyCap: integer("frequency_cap").notNull().default(3),
  language: text("language", { enum: ["en", "dv", "both"] }).notNull().default("both"),
  headlineEn: text("headline_en").notNull(),
  headlineDv: text("headline_dv").notNull(),
  summaryEn: text("summary_en").notNull(),
  summaryDv: text("summary_dv").notNull(),
  destinationUrl: text("destination_url").notNull(),
  ...timestamps,
});

export const campaignEvents = sqliteTable("campaign_events", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  anonymousId: text("anonymous_id").notNull(),
  type: text("type", { enum: ["impression", "click"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["poll", "extract", "cluster", "summarize", "notify"] }).notNull(),
  status: text("status", { enum: ["queued", "running", "retry", "complete", "failed"] }).notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  runAfter: integer("run_after", { mode: "timestamp" }).notNull(),
  lastError: text("last_error"),
  ...timestamps,
});

export const aiRuns = sqliteTable("ai_runs", {
  id: text("id").primaryKey(),
  articleId: text("article_id").notNull().references(() => sourceArticles.id),
  provider: text("provider", { enum: ["openai", "gemini"] }).notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  confidence: real("confidence"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  status: text("status", { enum: ["complete", "failed", "rejected"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  before: text("before", { mode: "json" }),
  after: text("after", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
