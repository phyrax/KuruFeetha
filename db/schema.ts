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
  youtubeVideoId: text("youtube_video_id"),
  sourceName: text("source_name"),
  sourceUrl: text("source_url"),
  isBreaking: integer("is_breaking", { mode: "boolean" }).notNull().default(false),
  isImportant: integer("is_important", { mode: "boolean" }).notNull().default(false),
  isTimeSensitive: integer("is_time_sensitive", { mode: "boolean" }).notNull().default(false),
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
  contentType: text("content_type", { enum: ["news", "opinion", "editorial", "press_release"] }),
  reviewStatus: text("review_status", { enum: ["draft", "published"] }).notNull().default("draft"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  reviewedBy: text("reviewed_by"),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  ...timestamps,
}, (table) => [uniqueIndex("card_language_idx").on(table.cardId, table.language)]);

export const authors = sqliteTable("authors", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["person", "organization"] }).notNull(),
  slug: text("slug").unique(),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  nameEn: text("name_en"),
  nameDv: text("name_dv"),
  bioEn: text("bio_en"),
  bioDv: text("bio_dv"),
  publicProfileEnabled: integer("public_profile_enabled", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, (table) => [index("idx_authors_status_kind").on(table.status, table.kind)]);

export const articleCredits = sqliteTable("article_credits", {
  id: text("id").primaryKey(),
  translationId: text("translation_id").notNull().references(() => newsCardTranslations.id),
  authorId: text("author_id").notNull().references(() => authors.id),
  role: text("role", { enum: ["author"] }).notNull().default("author"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  uniqueIndex("article_credit_translation_author_role_idx").on(table.translationId, table.authorId, table.role),
  index("idx_article_credits_translation_order").on(table.translationId, table.sortOrder),
]);

export const contentTypeRecommendations = sqliteTable("content_type_recommendations", {
  storyId: text("story_id").primaryKey().references(() => newsCards.id, { onDelete: "cascade" }),
  contentFingerprint: text("content_fingerprint").notNull(),
  recommendedType: text("recommended_type", { enum: ["news", "opinion", "editorial", "press_release"] }).notNull(),
  confidence: real("confidence").notNull(),
  reason: text("reason").notNull(),
  needsHumanReview: integer("needs_human_review", { mode: "boolean" }).notNull().default(true),
  flags: text("flags", { mode: "json" }).notNull(),
  languageRecommendations: text("language_recommendations", { mode: "json" }).notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  generatedAt: integer("generated_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("idx_content_type_recommendations_generated").on(table.generatedAt)]);

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

export const staffInvitations = sqliteTable("staff_invitations", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  status: text("status", { enum: ["pending", "accepted", "revoked", "delivery_failed"] }).notNull().default("pending"),
  invitedBy: text("invited_by").notNull().references(() => users.id),
  deliveredAt: integer("delivered_at", { mode: "timestamp" }),
  acceptedAt: integer("accepted_at", { mode: "timestamp" }),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  deliveryError: text("delivery_error"),
  ...timestamps,
}, (table) => [
  uniqueIndex("staff_invitation_email_idx").on(table.email),
  index("idx_staff_invitations_status_created").on(table.status, table.createdAt),
]);

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

export const advertisers = sqliteTable("advertisers", {
  id: text("id").primaryKey(), legalName: text("legal_name").notNull(), displayName: text("display_name").notNull(),
  billingEmail: text("billing_email").notNull(), billingPhone: text("billing_phone"), industry: text("industry"),
  verificationStatus: text("verification_status", { enum: ["pending", "verified", "rejected"] }).notNull().default("pending"),
  tourismLicence: text("tourism_licence"), agreementReference: text("agreement_reference"),
  politicalPurchaserName: text("political_purchaser_name"), politicalFundingEntity: text("political_funding_entity"), notes: text("notes"), ...timestamps,
});

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  advertiserId: text("advertiser_id").references(() => advertisers.id),
  sponsorName: text("sponsor_name").notNull(),
  paidForBy: text("paid_for_by").notNull().default(""),
  status: text("status", { enum: ["draft", "internal_review", "advertiser_review", "approved", "active", "paused", "completed", "archived"] }).notNull(),
  package: text("package", { enum: ["starter", "growth", "category_partner", "custom"] }).notNull().default("starter"),
  creativeType: text("creative_type", { enum: ["card", "full_image", "article", "gallery", "category_partner"] }).notNull().default("card"),
  categoryId: text("category_id").references(() => categories.id),
  placement: text("placement", { enum: ["feed", "category", "both"] }).notNull().default("feed"),
  platform: text("platform", { enum: ["all", "web", "mobile"] }).notNull().default("all"),
  isPolitical: integer("is_political", { mode: "boolean" }).notNull().default(false),
  ownerApprovedAt: integer("owner_approved_at", { mode: "timestamp" }),
  startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp" }).notNull(),
  frequencyCap: integer("frequency_cap").notNull().default(3),
  language: text("language", { enum: ["en", "dv", "both"] }).notNull().default("both"),
  headlineEn: text("headline_en").notNull(),
  headlineDv: text("headline_dv").notNull(),
  summaryEn: text("summary_en").notNull(),
  summaryDv: text("summary_dv").notNull(),
  imageKey: text("image_key"),
  imageUrl: text("image_url"),
  mobileImageKey: text("mobile_image_key"),
  mobileImageUrl: text("mobile_image_url"),
  desktopImageKey: text("desktop_image_key"),
  desktopImageUrl: text("desktop_image_url"),
  destinationUrl: text("destination_url").notNull(),
  invoiceNumber: text("invoice_number"),
  invoiceAmount: integer("invoice_amount"),
  invoiceDueAt: integer("invoice_due_at", { mode: "timestamp" }),
  paymentStatus: text("payment_status", { enum: ["unbilled", "invoiced", "paid", "overdue", "waived"] }).notNull().default("unbilled"),
  internalNotes: text("internal_notes"),
  ...timestamps,
}, (table) => [index("idx_campaigns_delivery").on(table.status, table.startsAt, table.endsAt, table.language)]);

export const campaignEvents = sqliteTable("campaign_events", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  anonymousId: text("anonymous_id").notNull(),
  type: text("type", { enum: ["impression", "click"] }).notNull(),
  eventKey: text("event_key").notNull().unique(),
  placement: text("placement").notNull().default("feed"),
  language: text("language", { enum: ["en", "dv"] }).notNull().default("en"),
  platform: text("platform", { enum: ["web", "mobile"] }).notNull().default("web"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("idx_campaign_events_report").on(table.campaignId, table.type, table.createdAt)]);

export const contentEvents = sqliteTable("content_events", {
  id: text("id").primaryKey(),
  eventKey: text("event_key").notNull().unique(),
  anonymousId: text("anonymous_id").notNull(),
  contentType: text("content_type", { enum: ["story", "gallery", "article"] }).notNull(),
  contentId: text("content_id").notNull(),
  type: text("type", { enum: ["view", "complete", "open", "engage"] }).notNull(),
  language: text("language", { enum: ["en", "dv"] }).notNull(),
  platform: text("platform", { enum: ["web", "mobile"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("idx_content_events_report").on(table.contentType, table.contentId, table.type, table.createdAt)]);

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
