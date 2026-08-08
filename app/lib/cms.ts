export type Language = "en" | "dv";
export type RichTextMark = { type: "bold" | "italic" | "link"; href?: string };
export type RichTextNode = { type: "doc" | "paragraph" | "heading" | "bulletList" | "orderedList" | "listItem" | "blockquote" | "text" | "hardBreak"; level?: 2 | 3; text?: string; marks?: RichTextMark[]; content?: RichTextNode[] };
export type RichTextDocument = RichTextNode & { type: "doc" };
export type TranslationInput = { headline?: string; summary?: string; published?: boolean; articleContent?: RichTextDocument | null; articlePublished?: boolean };

export function wordCount(value: string): number { return value.trim() ? value.trim().split(/\s+/u).length : 0; }

export function validateTranslation(value: TranslationInput | undefined, language: Language): string | null {
  if (!value) return null;
  const headline = value.headline?.trim() ?? "";
  const summary = value.summary?.trim() ?? "";
  if (!headline && !summary) return null;
  if (!headline || !summary) throw new Error(`${language.toUpperCase()} title and summary are both required`);
  if (headline.length > 180) throw new Error(`${language.toUpperCase()} title is too long`);
  if (wordCount(summary) > 70) throw new Error(`${language.toUpperCase()} summary exceeds 70 words`);
  return summary;
}

export function validHttpUrl(value?: string | null): boolean {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; }
}

const blockTypes = new Set(["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote"]);
const nodeTypes = new Set(["doc", ...blockTypes, "text", "hardBreak"]);

export function richTextHasContent(value: RichTextDocument | null | undefined): boolean {
  let text = "";
  const visit = (node: RichTextNode) => { if (node.type === "text") text += node.text ?? ""; node.content?.forEach(visit); };
  if (value) visit(value);
  return Boolean(text.trim());
}

export function validateRichText(value: unknown): RichTextDocument | null {
  if (value == null) return null;
  let textLength = 0;
  const visit = (node: unknown, depth: number, root = false): RichTextNode => {
    if (!node || typeof node !== "object" || depth > 12) throw new Error("Article formatting is invalid");
    const candidate = node as Record<string, unknown>;
    if (typeof candidate.type !== "string" || !nodeTypes.has(candidate.type)) throw new Error("Article contains unsupported formatting");
    if (root && candidate.type !== "doc") throw new Error("Article document is invalid");
    if (!root && candidate.type === "doc") throw new Error("Nested article documents are not supported");
    const clean: RichTextNode = { type: candidate.type as RichTextNode["type"] };
    if (candidate.type === "heading") clean.level = candidate.level === 3 ? 3 : 2;
    if (candidate.type === "text") {
      if (typeof candidate.text !== "string") throw new Error("Article text is invalid");
      textLength += candidate.text.length;
      if (textLength > 50000) throw new Error("Article exceeds 50,000 characters");
      clean.text = candidate.text;
      if (candidate.marks !== undefined) {
        if (!Array.isArray(candidate.marks) || candidate.marks.length > 3) throw new Error("Article text formatting is invalid");
        clean.marks = candidate.marks.map((mark) => {
          if (!mark || typeof mark !== "object") throw new Error("Article text formatting is invalid");
          const item = mark as Record<string, unknown>;
          if (item.type === "bold" || item.type === "italic") return { type: item.type };
          if (item.type === "link" && typeof item.href === "string" && validHttpUrl(item.href)) return { type: "link", href: item.href };
          throw new Error("Article contains an unsafe link or unsupported format");
        });
      }
    } else if (candidate.content !== undefined) {
      if (!Array.isArray(candidate.content) || candidate.content.length > 500) throw new Error("Article structure is too large");
      clean.content = candidate.content.map((child) => visit(child, depth + 1));
    } else if (blockTypes.has(candidate.type) || candidate.type === "doc") clean.content = [];
    return clean;
  };
  const document = visit(value, 0, true) as RichTextDocument;
  if (JSON.stringify(document).length > 256000) throw new Error("Article data is too large");
  return document;
}
