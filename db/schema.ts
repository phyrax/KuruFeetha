import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
};

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
  categoryId: text("category_id").references(() => categories.id),
  status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  sourceName: text("source_name"),
  sourceUrl: text("source_url"),
  isBreaking: integer("is_breaking", { mode: "boolean" }).notNull().default(false),
  isImportant: integer("is_important", { mode: "boolean" }).notNull().default(false),
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
  articleContent: text("article_content", { mode: "json" }),
  articleStatus: text("article_status", { enum: ["draft", "published"] }).notNull().default("draft"),
  articlePublishedAt: integer("article_published_at", { mode: "timestamp" }),
  reviewStatus: text("review_status", { enum: ["draft", "published"] }).notNull().default("draft"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  reviewedBy: text("reviewed_by"),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  ...timestamps,
}, (table) => [uniqueIndex("card_language_idx").on(table.cardId, table.language)]);

export const galleries = sqliteTable("galleries", {
  id: text("id").primaryKey(),
  topic: text("topic").notNull(),
  language: text("language", { enum: ["en", "dv"] }).notNull(),
  topicEn: text("topic_en"),
  topicDv: text("topic_dv"),
  publishedEn: integer("published_en", { mode: "boolean" }).notNull().default(false),
  publishedDv: integer("published_dv", { mode: "boolean" }).notNull().default(false),
  categoryId: text("category_id").references(() => categories.id),
  relatedStoryId: text("related_story_id").references(() => newsCards.id),
  relatedStoryEnId: text("related_story_en_id").references(() => newsCards.id),
  relatedStoryDvId: text("related_story_dv_id").references(() => newsCards.id),
  status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  ...timestamps,
}, (table) => [index("idx_galleries_language_status_published").on(table.language, table.status, table.publishedAt)]);

export const galleryImages = sqliteTable("gallery_images", {
  id: text("id").primaryKey(),
  galleryId: text("gallery_id").notNull().references(() => galleries.id),
  imageKey: text("image_key").notNull(),
  imageUrl: text("image_url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("idx_gallery_images_gallery_order").on(table.galleryId, table.sortOrder)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  authSubject: text("auth_subject").unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  role: text("role", { enum: ["reader", "admin", "owner"] }).notNull().default("reader"),
  status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
  preferredLanguage: text("preferred_language", { enum: ["en", "dv"] }).notNull().default("en"),
  notifyBreaking: integer("notify_breaking", { mode: "boolean" }).notNull().default(true),
  notifyImportant: integer("notify_important", { mode: "boolean" }).notNull().default(false),
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

export const contentLikes = sqliteTable("content_likes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  contentType: text("content_type", { enum: ["story", "gallery"] }).notNull(),
  contentId: text("content_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  uniqueIndex("content_like_user_content_idx").on(table.userId, table.contentType, table.contentId),
  index("idx_content_likes_user_type").on(table.userId, table.contentType),
]);

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
