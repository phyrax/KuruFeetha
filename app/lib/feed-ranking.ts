export type FreshnessItem = { kind: "story" | "gallery"; publishedAt: number; timeSensitive?: number | boolean };

export function timestampMs(value: number): number { return value < 1e12 ? value * 1000 : value; }

export function maldivesDay(value: number): number {
  return Math.floor((timestampMs(value) + 5 * 60 * 60_000) / (24 * 60 * 60_000));
}

export function freshnessGroup(item: FreshnessItem, now: number): number {
  const published = timestampMs(item.publishedAt), age = Math.max(0, now - published);
  if (item.kind === "story" && item.timeSensitive && age >= 24 * 60 * 60_000) return 0;
  const dayAge = Math.max(0, maldivesDay(now) - maldivesDay(published));
  if (dayAge < 7) return 10 - dayAge;
  return 1;
}
