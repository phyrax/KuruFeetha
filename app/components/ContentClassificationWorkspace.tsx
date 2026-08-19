"use client";
import { useEffect, useState } from "react";
import { isStreamlinedNewsEligible } from "../lib/classification-eligibility";
import {
  canEnterHumanReviewedBatch,
  humanReviewBatchBlockReason,
  isHumanReviewNewsEligible,
  preferredFirstReviewStoryIds,
} from "../lib/human-news-review";

type ContentType = "news" | "opinion" | "editorial" | "press_release";
type Translation = {
  id: string;
  language: "en" | "dv";
  headline: string;
  contentType: ContentType | null;
  publishedAt: number;
  articlePublishedAt: number;
  articleUrl: string;
  authors: Array<{
    kind: string;
    nameEn: string | null;
    nameDv: string | null;
  }>;
};
type Recommendation = {
  recommendedType: ContentType;
  confidence: number;
  reason: string;
  needsHumanReview: boolean;
  flags: Array<{ code: string; message: string }>;
  languageRecommendations: { en: ContentType | null; dv: ContentType | null };
  provider: string;
  model: string;
  generatedAt: number;
  cached: boolean;
};
type Item = {
  storyId: string;
  category: string | null;
  languages: string[];
  translations: Translation[];
  recommendation: Recommendation | null;
  staleRecommendation: boolean;
};
type Probe = "plain" | "structured" | "classifier_schema";
type ProbeResult = {
  ok: boolean;
  result?: {
    probe: Probe;
    provider: string;
    model: string;
    httpStatus: number;
    requestId: string | null;
  };
  diagnostic?: {
    diagnosticCode: string;
    provider: string;
    model: string;
    httpStatus: number | null;
    errorType: string | null;
    errorCode: string | null;
    message: string;
    requestId: string | null;
    responseStatus: string | null;
    incompleteReason: string | null;
  };
};
type CalibrationResult = {
  ok: boolean;
  storyId: string;
  humanType?: "news";
  requestId?: string | null;
  latencyMs?: number;
  recommendation?: Recommendation & { fingerprint: string };
  error?: { message?: string };
};
const labels: Record<ContentType, string> = {
  news: "News",
  opinion: "Opinion",
  editorial: "Editorial",
  press_release: "Press Release",
};

export function ContentClassificationWorkspace({
  token,
  notify,
}: {
  token: string;
  notify: (message: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [loading, setLoading] = useState(true),
    [analyzing, setAnalyzing] = useState<Set<string>>(new Set()),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [reviewedNews, setReviewedNews] = useState<Set<string>>(new Set()),
    [humanBatch, setHumanBatch] = useState<Set<string>>(new Set()),
    [choices, setChoices] = useState<Record<string, ContentType>>({}),
    [approving, setApproving] = useState(false),
    [probing, setProbing] = useState<Probe | null>(null),
    [probeResults, setProbeResults] = useState<
      Partial<Record<Probe, ProbeResult>>
    >({}),
    [calibrating, setCalibrating] = useState(false),
    [calibration, setCalibration] = useState<CalibrationResult[]>([]),
    [benchmarking, setBenchmarking] = useState(false),
    [benchmarkReport, setBenchmarkReport] = useState<string | null>(null);
  const headers = { authorization: `Bearer ${token}` };
  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/admin/content-classification", {
          headers,
          cache: "no-store",
        }),
        data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error?.message || "Could not load classification workspace",
        );
      setItems(data.items ?? []);
      setSelected(new Set());
      setReviewedNews(new Set());
      setHumanBatch(new Set());
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setLoading(false);
    }
  }
  // The parent notification callback is intentionally excluded: its identity changes on reader-shell renders.
  useEffect(() => {
    let active = true;
    void fetch("/api/v1/admin/content-classification", {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error?.message || "Could not load classification workspace",
          );
        if (active) {
          setItems(data.items ?? []);
          setSelected(new Set());
          setReviewedNews(new Set());
          setHumanBatch(new Set());
        }
      })
      .catch((error) => {
        if (active) notify((error as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // The parent callback identity changes on reader-shell renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  async function analyze(storyId?: string, force = false) {
    const key = storyId || "all";
    setAnalyzing((current) => new Set(current).add(key));
    try {
      const response = await fetch(
          "/api/v1/admin/content-classification/analyze",
          {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify(
              storyId ? { storyId, force } : { analyzeAll: true },
            ),
          },
        ),
        data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message || "Analysis failed");
      const failures = (data.results ?? []).filter(
        (result: { ok: boolean }) => !result.ok,
      );
      if (failures.length) {
        const first = failures[0]?.error,
          detail = [first?.message, first?.errorCode, first?.requestId]
            .filter(Boolean)
            .join(" · ");
        notify(
          detail ||
            `${data.results.length - failures.length} analyzed; ${failures.length} need retry`,
        );
      } else
        notify(
          `${data.results.length} recommendation${data.results.length === 1 ? "" : "s"} ready`,
        );
      await load();
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setAnalyzing((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }
  async function runProbe(probe: Probe) {
    setProbing(probe);
    try {
      const response = await fetch(
          "/api/v1/admin/content-classification/probe",
          {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({ probe }),
          },
        ),
        data = (await response.json()) as ProbeResult;
      if (!response.ok)
        throw new Error(
          (data as { error?: { message?: string } }).error?.message ||
            "Provider probe failed",
        );
      setProbeResults((current) => ({ ...current, [probe]: data }));
      notify(
        data.ok
          ? `${probe} provider probe succeeded`
          : [
              data.diagnostic?.message,
              data.diagnostic?.errorCode,
              data.diagnostic?.requestId,
            ]
              .filter(Boolean)
              .join(" · ") || "Provider probe failed",
      );
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setProbing(null);
    }
  }
  async function runCalibration() {
    setCalibrating(true);
    try {
      const response = await fetch(
          "/api/v1/admin/content-classification/calibrate",
          {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({ dataset: "batch1" }),
          },
        ),
        data = (await response.json()) as {
          results?: CalibrationResult[];
          error?: { message?: string };
        };
      if (!response.ok)
        throw new Error(data.error?.message || "Calibration failed");
      setCalibration(data.results ?? []);
      notify(
        `${(data.results ?? []).filter((item) => item.ok).length} trusted stories analyzed`,
      );
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setCalibrating(false);
    }
  }
  async function runBalancedBenchmark() {
    setBenchmarking(true);
    setBenchmarkReport(null);
    try {
      const response = await fetch(
          "/api/v1/admin/content-classification/benchmark",
          {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({ dataset: "content-type-balanced-v1" }),
          },
        ),
        data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message || "Balanced benchmark failed");
      setBenchmarkReport(JSON.stringify(data, null, 2));
      notify(`${data.cases ?? 0} balanced benchmark cases analyzed`);
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setBenchmarking(false);
    }
  }
  async function approveItem(item: Item, type: ContentType) {
    let updated = 0;
    for (const translation of item.translations.filter(
      (t) => t.contentType === null,
    )) {
      const response = await fetch(
        `/api/v1/admin/cards/${item.storyId}/content-type`,
        {
          method: "PATCH",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({
            translationId: translation.id,
            contentType: type,
            expectedContentType: null,
          }),
        },
      );
      if (response.status === 409) {
        notify(
          `${translation.language.toUpperCase()} is stale; reload and review again`,
        );
        continue;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          data?.error?.message ||
            `Could not update ${translation.language.toUpperCase()}`,
        );
      updated++;
    }
    return updated;
  }
  async function approveOne(item: Item, type: ContentType) {
    setApproving(true);
    try {
      const updated = await approveItem(item, type);
      notify(
        `${updated} translation${updated === 1 ? "" : "s"} classified as ${labels[type]}`,
      );
      await load();
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setApproving(false);
    }
  }
  async function approveBulk() {
    const approved = items.filter(
      (item) =>
        selected.has(item.storyId) &&
        isStreamlinedNewsEligible(item.translations, item.recommendation),
    );
    if (!approved.length)
      return notify("Select at least one eligible News recommendation");
    if (
      !confirm(
        `Classify ${approved.reduce((sum, item) => sum + item.translations.filter((t) => t.contentType === null).length, 0)} translations across ${approved.length} stories as News?`,
      )
    )
      return;
    setApproving(true);
    let updated = 0;
    try {
      for (const item of approved) updated += await approveItem(item, "news");
      notify(`${updated} selected translations classified as News`);
      await load();
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setApproving(false);
    }
  }
  async function approveHumanReviewedNews() {
    const approved = items.filter((item) =>
      humanBatch.has(item.storyId) &&
      canEnterHumanReviewedBatch(
        item.storyId,
        item.translations,
        item.recommendation,
        reviewedNews.has(item.storyId),
        item.staleRecommendation,
      ),
    );
    if (!approved.length)
      return notify("Review and select at least one eligible News story");
    const translations = approved.flatMap((item) =>
      item.translations
        .filter(({ contentType }) => contentType === null)
        .map(({ language }) => language.toUpperCase()),
    );
    const message = [
      `Approve ${approved.length} reviewed stories (${translations.length} translations)?`,
      "Selected type: News",
      `Story IDs: ${approved.map(({ storyId }) => storyId).join(", ")}`,
      `Languages affected: ${translations.join(", ")}`,
    ].join("\n\n");
    if (!confirm(message)) return;
    setApproving(true);
    let updated = 0;
    try {
      for (const item of approved) updated += await approveItem(item, "news");
      notify(`${updated} reviewed translations classified as News`);
      await load();
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setApproving(false);
    }
  }
  if (loading)
    return (
      <div className="classification-empty">
        Loading classification workspace…
      </div>
    );
  return (
    <>
      <header className="desk-header">
        <div>
          <p className="eyebrow">EDITORIAL ASSISTANT</p>
          <h1>Content classification</h1>
          <p>
            AI recommendations never publish or classify content until an editor
            approves them.
          </p>
        </div>
        <button
          className="primary-action compact"
          disabled={analyzing.has("all")}
          onClick={() => analyze()}
        >
          {analyzing.has("all") ? "Analyzing…" : "Analyze all NULL stories"}
        </button>
      </header>
      <div className="classification-toolbar">
        <div>
          <strong>Provider diagnostics</strong>
          <p>
            Admin-only probes use synthetic text and never alter story
            classifications.
          </p>
          <div className="classification-actions">
            <button
              disabled={probing !== null}
              onClick={() => runProbe("plain")}
            >
              {probing === "plain" ? "Checking…" : "Probe A · Plain"}
            </button>
            <button
              disabled={probing !== null || !probeResults.plain?.ok}
              onClick={() => runProbe("structured")}
            >
              {probing === "structured" ? "Checking…" : "Probe B · Structured"}
            </button>
            <button
              disabled={probing !== null || !probeResults.structured?.ok}
              onClick={() => runProbe("classifier_schema")}
            >
              {probing === "classifier_schema"
                ? "Checking…"
                : "Probe C · Classifier schema"}
            </button>
            <button disabled={calibrating} onClick={runCalibration}>
              {calibrating ? "Calibrating…" : "Run trusted Batch 1 calibration"}
            </button>
            <button disabled={benchmarking} onClick={runBalancedBenchmark}>
              {benchmarking ? "Benchmarking…" : "Run balanced benchmark"}
            </button>
          </div>
          {Object.entries(probeResults).map(([name, value]) => (
            <small key={name} role="status">
              <b>{name}:</b>{" "}
              {value.ok
                ? `passed · ${value.result?.model} · HTTP ${value.result?.httpStatus}${value.result?.requestId ? ` · ${value.result.requestId}` : ""}`
                : `failed · ${value.diagnostic?.message}${value.diagnostic?.errorCode ? ` · ${value.diagnostic.errorCode}` : ""}${value.diagnostic?.requestId ? ` · ${value.diagnostic.requestId}` : ""}`}
            </small>
          ))}
        </div>
      </div>
      {benchmarkReport && (
        <details className="classification-list" open>
          <summary>Balanced benchmark report</summary>
          <pre data-testid="balanced-benchmark-report">{benchmarkReport}</pre>
        </details>
      )}
      {calibration.length > 0 && (
        <div
          className="classification-list"
          aria-label="Trusted Batch 1 calibration results"
        >
          {calibration.map((item) => (
            <article className="classification-card" key={item.storyId}>
              <code>{item.storyId}</code>
              {item.ok && item.recommendation ? (
                <div className="classification-result">
                  <div>
                    <strong>
                      {labels[item.recommendation.recommendedType]}
                    </strong>
                    <span>
                      {Math.round(item.recommendation.confidence * 100)}%
                      confidence
                    </span>
                    <span>
                      EN:{" "}
                      {item.recommendation.languageRecommendations.en
                        ? labels[item.recommendation.languageRecommendations.en]
                        : "Unavailable"}
                    </span>
                    <span>
                      DV:{" "}
                      {item.recommendation.languageRecommendations.dv
                        ? labels[item.recommendation.languageRecommendations.dv]
                        : "Unavailable"}
                    </span>
                    <span>
                      {item.recommendation.needsHumanReview
                        ? "Manual review required"
                        : "No mandatory review"}
                    </span>
                  </div>
                  <p>{item.recommendation.reason}</p>
                  {item.recommendation.flags.length > 0 && (
                    <ul>
                      {item.recommendation.flags.map((flag) => (
                        <li key={flag.code}>
                          <b>{flag.code}</b>: {flag.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  <small>
                    {item.recommendation.model} ·{" "}
                    {item.requestId || "No request ID"} · {item.latencyMs} ms ·{" "}
                    {item.recommendation.fingerprint}
                  </small>
                </div>
              ) : (
                <p>{item.error?.message || "Calibration failed"}</p>
              )}
            </article>
          ))}
        </div>
      )}
      <div className="classification-toolbar">
        <span>{items.length} stories awaiting classification</span>
        <button
          className="primary-action compact"
          disabled={approving || !selected.size}
          onClick={approveBulk}
        >
          Approve selected high-confidence News ({selected.size})
        </button>
      </div>
      <section className="classification-human-lane" aria-labelledby="human-news-heading">
        <div className="classification-toolbar">
          <div>
            <h2 id="human-news-heading">News — Human Review</h2>
            <p>AI recommends News, but every story requires an explicit editorial review.</p>
          </div>
          <button
            className="primary-action compact"
            disabled={approving || humanBatch.size === 0}
            onClick={approveHumanReviewedNews}
          >
            Approve reviewed News ({humanBatch.size})
          </button>
        </div>
        <div className="classification-list">
          {items
            .filter((item) =>
              isHumanReviewNewsEligible(item.translations, item.recommendation),
            )
            .sort((a, b) => {
              const ai = preferredFirstReviewStoryIds.indexOf(
                  a.storyId as (typeof preferredFirstReviewStoryIds)[number],
                ),
                bi = preferredFirstReviewStoryIds.indexOf(
                  b.storyId as (typeof preferredFirstReviewStoryIds)[number],
                );
              return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
            })
            .map((item) => {
              const recommendation = item.recommendation!,
                reviewed = reviewedNews.has(item.storyId),
                blockReason = humanReviewBatchBlockReason(
                  item.storyId,
                  recommendation,
                ),
                batchEligible = canEnterHumanReviewedBatch(
                  item.storyId,
                  item.translations,
                  recommendation,
                  reviewed,
                  item.staleRecommendation,
                ),
                firstBatch = preferredFirstReviewStoryIds.includes(
                  item.storyId as (typeof preferredFirstReviewStoryIds)[number],
                );
              return (
                <article className="classification-card" key={`human-${item.storyId}`}>
                  <div className="classification-card-head">
                    <code>{item.storyId}</code>
                    {firstBatch && <span>Suggested first review batch</span>}
                    <span>{item.category || "Uncategorized"}</span>
                  </div>
                  <div className="classification-translations">
                    {item.translations.map((translation) => (
                      <section key={translation.id} dir={translation.language === "dv" ? "rtl" : "ltr"}>
                        <strong>{translation.language.toUpperCase()}</strong>
                        <h3>{translation.headline}</h3>
                        <p>Current type: <b>{translation.contentType ? labels[translation.contentType] : "Not classified"}</b></p>
                        <p>Published: {new Intl.DateTimeFormat("en-MV", { dateStyle: "medium", timeStyle: "short", timeZone: "Indian/Maldives" }).format(translation.articlePublishedAt)}</p>
                        <a href={translation.articleUrl} target="_blank" rel="noopener noreferrer">Read complete article ↗</a>
                      </section>
                    ))}
                  </div>
                  <div className="classification-result">
                    <div>
                      <strong>News</strong>
                      <span>{Math.round(recommendation.confidence * 100)}% confidence</span>
                      <span>EN: {recommendation.languageRecommendations.en ? labels[recommendation.languageRecommendations.en] : "Unavailable"}</span>
                      <span>DV: {recommendation.languageRecommendations.dv ? labels[recommendation.languageRecommendations.dv] : "Unavailable"}</span>
                    </div>
                    <p>{recommendation.reason}</p>
                    {recommendation.flags.length > 0 && <ul>{recommendation.flags.map((flag) => <li key={flag.code}><b>{flag.code}</b>: {flag.message}</li>)}</ul>}
                    {blockReason && <p className="review-required">Individual article-pair review required: {blockReason}</p>}
                  </div>
                  <div className="classification-actions">
                    <label className="classification-select">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(event) => setReviewedNews((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(item.storyId);
                          else { next.delete(item.storyId); setHumanBatch((batch) => { const updated = new Set(batch); updated.delete(item.storyId); return updated; }); }
                          return next;
                        })}
                      />
                      <span>Reviewed — approve as News</span>
                    </label>
                    <label className="classification-select">
                      <input
                        type="checkbox"
                        disabled={!batchEligible}
                        checked={humanBatch.has(item.storyId)}
                        onChange={(event) => setHumanBatch((current) => { const next = new Set(current); if (event.target.checked) next.add(item.storyId); else next.delete(item.storyId); return next; })}
                      />
                      <span>Add to multi-story approval</span>
                    </label>
                  </div>
                </article>
              );
            })}
        </div>
      </section>
      <div className="classification-list">
        {items.map((item) => {
          const recommendation = item.recommendation,
            eligible = isStreamlinedNewsEligible(
              item.translations,
              recommendation,
            ),
            choice =
              choices[item.storyId] ||
              recommendation?.recommendedType ||
              "news";
          return (
            <article className="classification-card" key={item.storyId}>
              <div className="classification-card-head">
                <label className="classification-select">
                  <input
                    type="checkbox"
                    disabled={!eligible}
                    checked={selected.has(item.storyId)}
                    onChange={(event) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(item.storyId);
                        else next.delete(item.storyId);
                        return next;
                      })
                    }
                  />
                  <span>Bulk News approval</span>
                </label>
                <code>{item.storyId}</code>
                <span>{item.category || "Uncategorized"}</span>
              </div>
              <div className="classification-translations">
                {item.translations.map((translation) => (
                  <section
                    key={translation.id}
                    dir={translation.language === "dv" ? "rtl" : "ltr"}
                  >
                    <strong>{translation.language.toUpperCase()}</strong>
                    <h3>{translation.headline}</h3>
                    <p>
                      Current type:{" "}
                      <b>
                        {translation.contentType
                          ? labels[translation.contentType]
                          : "Not classified"}
                      </b>
                    </p>
                    <p>
                      Published:{" "}
                      {new Intl.DateTimeFormat("en-MV", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Indian/Maldives",
                      }).format(translation.articlePublishedAt)}
                    </p>
                    <p>
                      Byline:{" "}
                      {translation.authors.length
                        ? translation.authors
                            .map((author) =>
                              translation.language === "dv"
                                ? author.nameDv || author.nameEn
                                : author.nameEn || author.nameDv,
                            )
                            .join(", ")
                        : "No author credit"}
                    </p>
                    <a
                      href={translation.articleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Read complete article ↗
                    </a>
                  </section>
                ))}
              </div>
              {item.staleRecommendation && (
                <div className="classification-warning">
                  Article content changed after the previous recommendation.
                  Analyze again before approval.
                </div>
              )}
              {recommendation ? (
                <div className="classification-result">
                  <div>
                    <strong>{labels[recommendation.recommendedType]}</strong>
                    <span>
                      {Math.round(recommendation.confidence * 100)}% confidence
                    </span>
                    <span>
                      EN:{" "}
                      {recommendation.languageRecommendations.en
                        ? labels[recommendation.languageRecommendations.en]
                        : "Unavailable"}
                    </span>
                    <span>
                      DV:{" "}
                      {recommendation.languageRecommendations.dv
                        ? labels[recommendation.languageRecommendations.dv]
                        : "Unavailable"}
                    </span>
                    <span
                      className={
                        recommendation.needsHumanReview
                          ? "review-required"
                          : "review-eligible"
                      }
                    >
                      {recommendation.needsHumanReview
                        ? "Manual review required"
                        : "Eligible for selected News approval"}
                    </span>
                  </div>
                  <p>{recommendation.reason}</p>
                  {recommendation.flags.length > 0 && (
                    <ul>
                      {recommendation.flags.map((flag) => (
                        <li key={flag.code}>
                          <b>{flag.code}</b>: {flag.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  <small>
                    {recommendation.provider} · {recommendation.model} ·{" "}
                    {new Date(recommendation.generatedAt).toLocaleString()}
                  </small>
                </div>
              ) : (
                <div className="classification-empty">
                  No current recommendation.
                </div>
              )}
              <div className="classification-actions">
                <button
                  disabled={analyzing.has(item.storyId)}
                  onClick={() =>
                    analyze(item.storyId, item.staleRecommendation)
                  }
                >
                  {analyzing.has(item.storyId)
                    ? "Analyzing…"
                    : item.staleRecommendation
                      ? "Refresh stale record"
                      : "Analyze"}
                </button>
                {recommendation && !item.staleRecommendation && (
                  <>
                    <button
                      className="primary-action compact"
                      disabled={approving}
                      onClick={() =>
                        approveOne(item, recommendation.recommendedType)
                      }
                    >
                      Approve recommendation
                    </button>
                    <label>
                      Choose another type
                      <select
                        value={choice}
                        onChange={(event) =>
                          setChoices({
                            ...choices,
                            [item.storyId]: event.target.value as ContentType,
                          })
                        }
                      >
                        {Object.entries(labels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={approving}
                      onClick={() => approveOne(item, choice)}
                    >
                      Approve chosen type
                    </button>
                  </>
                )}
                <button
                  onClick={() =>
                    setItems((current) =>
                      current.filter((entry) => entry.storyId !== item.storyId),
                    )
                  }
                >
                  Skip / review later
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
