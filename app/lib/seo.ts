export const SITE_URL = "https://kurufeetha.com";
export const SITE_NAME = "KuruFeetha";
export const SITE_DESCRIPTION = "Bilingual, editor-reviewed news from across the Maldives in 70 words or fewer.";

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

export function timestampToIso(value: number) {
  return new Date(value < 1e12 ? value * 1000 : value).toISOString();
}
