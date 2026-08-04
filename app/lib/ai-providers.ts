import type { AiDraft, AiProvider, Language } from "./news";
import { validateDraft } from "./news";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "object", additionalProperties: false, properties: { en: { type: "string" }, dv: { type: "string" } }, required: ["en", "dv"] },
    summary: { type: "object", additionalProperties: false, properties: { en: { type: "string" }, dv: { type: "string" } }, required: ["en", "dv"] },
    categories: { type: "array", items: { type: "string" } },
    namedEntities: { type: "array", items: { type: "string" } },
    factualClaims: { type: "array", items: { type: "object", additionalProperties: false, properties: { claim: { type: "string" }, evidence: { type: "string" } }, required: ["claim", "evidence"] } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    safetyFlags: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "summary", "categories", "namedEntities", "factualClaims", "confidence", "safetyFlags"],
} as const;

function prompt(article: { title: string; body: string; language: Language }) {
  return `You are a bilingual Maldives news editor. Create faithful English and Dhivehi drafts using only the supplied article. Each summary must be natural and no more than 60 whitespace-delimited words. Preserve names, dates, numbers, uncertainty and attribution. Do not add background facts. Evidence must be a short exact span from the supplied article. Return only the requested JSON.\n\nSOURCE LANGUAGE: ${article.language}\nTITLE: ${article.title}\nARTICLE:\n${article.body.slice(0, 45_000)}`;
}

function parseDraft(value: string): AiDraft {
  const draft = JSON.parse(value) as AiDraft;
  const errors = validateDraft(draft);
  if (errors.length) throw new Error(`Invalid AI draft: ${errors.join("; ")}`);
  return draft;
}

export class OpenAiProvider implements AiProvider {
  readonly name = "openai" as const;
  constructor(private key: string, private model: string) {}
  async createDraft(article: { title: string; body: string; language: Language }): Promise<AiDraft> {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${this.key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        input: prompt(article),
        text: { format: { type: "json_schema", name: "news_card", strict: true, schema } },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const json = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const output = json.output_text ?? json.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
    return parseDraft(output);
  }
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini" as const;
  constructor(private key: string, private model: string) {}
  async createDraft(article: { title: string; body: string; language: Language }): Promise<AiDraft> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": this.key, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt(article) }] }], generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema } }),
    });
    if (!response.ok) throw new Error(`Gemini returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const json = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return parseDraft(json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "");
  }
}

export async function generateWithFallback(article: { title: string; body: string; language: Language }, env: Record<string, string | undefined>) {
  const providers: AiProvider[] = [];
  if (env.OPENAI_API_KEY) providers.push(new OpenAiProvider(env.OPENAI_API_KEY, env.OPENAI_MODEL || "gpt-5.6-sol"));
  if (env.GEMINI_API_KEY) providers.push(new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL || "gemini-2.5-flash"));
  if (!providers.length) throw new Error("No AI provider is configured");
  const failures: string[] = [];
  for (const provider of providers) {
    try { return { draft: await provider.createDraft(article), provider: provider.name }; }
    catch (error) { failures.push(`${provider.name}: ${error instanceof Error ? error.message : "failed"}`); }
  }
  throw new Error(`All AI providers failed: ${failures.join(" | ")}`);
}
