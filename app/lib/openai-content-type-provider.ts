import {
  classifierFlagCodes,
  classifierSchemaVersion,
  validateClassifierResult,
  type ClassifierStory,
  type ContentTypeClassifierProvider,
} from "./content-type-classifier.ts";

type ProviderEnv = {
  OPENAI_API_KEY?: string;
  CONTENT_CLASSIFIER_MODEL?: string;
};
type OpenAIErrorBody = {
  error?: { type?: unknown; code?: unknown; message?: unknown };
  status?: unknown;
  incomplete_details?: { reason?: unknown };
};
export type ProviderDiagnostic = {
  diagnosticCode: "OPENAI_PROVIDER_FAILURE";
  provider: "openai";
  model: string;
  httpStatus: number | null;
  errorType: string | null;
  errorCode: string | null;
  message: string;
  requestId: string | null;
  responseStatus: string | null;
  incompleteReason: string | null;
};

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "recommendedType",
    "confidence",
    "reason",
    "needsHumanReview",
    "flags",
    "languageRecommendations",
  ],
  properties: {
    schemaVersion: { type: "string", enum: [classifierSchemaVersion] },
    recommendedType: {
      type: "string",
      enum: ["news", "opinion", "editorial", "press_release"],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string", maxLength: 500 },
    needsHumanReview: { type: "boolean" },
    flags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "message"],
        properties: {
          code: { type: "string", enum: [...classifierFlagCodes] },
          message: { type: "string", maxLength: 240 },
        },
      },
    },
    languageRecommendations: {
      type: "object",
      additionalProperties: false,
      required: ["en", "dv"],
      properties: {
        en: {
          type: ["string", "null"],
          enum: ["news", "opinion", "editorial", "press_release", null],
        },
        dv: {
          type: ["string", "null"],
          enum: ["news", "opinion", "editorial", "press_release", null],
        },
      },
    },
  },
};
const instructions = `Classify the journalistic format of the KuruFeetha article itself, not the opinions of quoted people. Use exactly news, opinion, editorial, or press_release.

Definitions:
- news: factual reporting of events, developments, statements, decisions, data, investigations, allegations, or public-interest information. Neutral reporting remains news even when a quoted person advocates strongly or the source is an institution.
- opinion: an identified contributor's own argument or analysis, commentary, interpretation, or personal viewpoint.
- editorial: KuruFeetha's institutional position.
- press_release: substantially reproduces or lightly adapts supplied external communication from an institution, organization, company, authority, political actor, or similar source. An independently reported announcement is news.

Confidence means certainty that the selected content type is correct, not confidence in factual accuracy, attribution quality, source provenance, translation quality, or writing quality. Apply this rubric consistently:
- 0.95–1.00: the format is unmistakable and no competing content type is plausible.
- 0.90–0.94: the type is clear; minor style, source, attribution, or translation concerns do not support a competing type.
- 0.80–0.89: the type is probable, but a plausible competing type remains.
- 0.60–0.79: material content-type ambiguity exists.
- below 0.60: the type cannot be determined reliably.
Do not lower content-type confidence merely because attribution, provenance, or translation could be improved. Represent those concerns with the appropriate stable flag instead.

Read every complete supplied translation. Recommend each available language separately. Use BILINGUAL_TYPE_DISAGREEMENT only when the types differ. Use CONTENT_TYPE_AMBIGUITY or NEWS_PRESS_RELEASE_UNCERTAINTY only when a competing type is genuinely plausible. Use INCOMPLETE_INPUT only when the supplied article is materially incomplete for classification. Flag other editorial-quality concerns with their specific stable code. Return concise editorial reasoning, not private chain-of-thought. Set schemaVersion to ${classifierSchemaVersion}. The application will deterministically calculate needsHumanReview from confidence, type, language agreement, and flag codes.`;

function safeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function sanitizeMessage(value: unknown, key?: string) {
  let message = safeString(value) || "OpenAI provider request failed";
  if (key) message = message.split(key).join("[REDACTED]");
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|sess)-[A-Za-z0-9_-]+\b/g, "[REDACTED]")
    .slice(0, 500);
}
export class OpenAIProviderError extends Error {
  diagnostic: ProviderDiagnostic;
  constructor(diagnostic: ProviderDiagnostic) {
    super(diagnostic.message);
    this.name = "OpenAIProviderError";
    this.diagnostic = diagnostic;
  }
}
export function providerDiagnostic(error: unknown) {
  return error instanceof OpenAIProviderError ? error.diagnostic : null;
}

export class OpenAIContentTypeProvider implements ContentTypeClassifierProvider {
  provider = "openai";
  model: string;
  lastRequestId: string | null = null;
  private key: string;
  constructor(env: ProviderEnv) {
    if (!env.OPENAI_API_KEY)
      throw new Error("AI classification is not configured");
    this.key = env.OPENAI_API_KEY;
    this.model = env.CONTENT_CLASSIFIER_MODEL || "gpt-5.4-nano";
  }
  private diagnostic(
    body: OpenAIErrorBody | null,
    httpStatus: number | null,
    requestId: string | null,
    message?: unknown,
  ): ProviderDiagnostic {
    return {
      diagnosticCode: "OPENAI_PROVIDER_FAILURE",
      provider: "openai",
      model: this.model,
      httpStatus,
      errorType: safeString(body?.error?.type),
      errorCode: safeString(body?.error?.code),
      message: sanitizeMessage(message ?? body?.error?.message, this.key),
      requestId,
      responseStatus: safeString(body?.status),
      incompleteReason: safeString(body?.incomplete_details?.reason),
    };
  }
  private async request(payload: Record<string, unknown>) {
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new OpenAIProviderError(
        this.diagnostic(
          null,
          null,
          null,
          error instanceof Error
            ? error.message
            : "OpenAI network request failed",
        ),
      );
    }
    const requestId = response.headers.get("x-request-id"),
      body = (await response
        .json()
        .catch(() => null)) as OpenAIErrorBody | null;
    if (!response.ok)
      throw new OpenAIProviderError(
        this.diagnostic(body, response.status, requestId),
      );
    if (body?.status === "failed")
      throw new OpenAIProviderError(
        this.diagnostic(
          body,
          response.status,
          requestId,
          body.error?.message || "OpenAI response failed",
        ),
      );
    if (body?.status === "incomplete")
      throw new OpenAIProviderError(
        this.diagnostic(
          body,
          response.status,
          requestId,
          body.incomplete_details?.reason
            ? `OpenAI response incomplete: ${body.incomplete_details.reason}`
            : "OpenAI response incomplete",
        ),
      );
    return {
      body: body as OpenAIErrorBody & {
        output_text?: string;
        output?: Array<{
          content?: Array<{ type?: string; text?: string; refusal?: string }>;
        }>;
      },
      requestId,
      httpStatus: response.status,
    };
  }
  private outputText(
    body: {
      output_text?: string;
      output?: Array<{
        content?: Array<{ type?: string; text?: string; refusal?: string }>;
      }>;
    },
    requestId: string | null,
    httpStatus: number,
  ) {
    const content = body.output?.flatMap((item) => item.content ?? []) ?? [],
      text =
        body.output_text ||
        content.find((item) => item.type === "output_text")?.text,
      refusal = content.find((item) => item.type === "refusal")?.refusal;
    if (!text)
      throw new OpenAIProviderError(
        this.diagnostic(
          body,
          httpStatus,
          requestId,
          refusal || "OpenAI provider returned no output text",
        ),
      );
    return text;
  }
  private structuredPayload(
    input: string,
    schema: Record<string, unknown>,
    name: string,
    instructionText?: string,
  ) {
    return {
      model: this.model,
      store: false,
      ...(instructionText ? { instructions: instructionText } : {}),
      input,
      text: { format: { type: "json_schema", name, strict: true, schema } },
    };
  }
  async probePlain() {
    const result = await this.request({
      model: this.model,
      store: false,
      input: "Return the word OK.",
    });
    return {
      probe: "plain",
      provider: this.provider,
      model: this.model,
      httpStatus: result.httpStatus,
      requestId: result.requestId,
      outputReceived: Boolean(
        this.outputText(result.body, result.requestId, result.httpStatus),
      ),
    };
  }
  async probeStructured() {
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["result"],
      properties: { result: { type: "string", enum: ["ok"] } },
    };
    const result = await this.request(
      this.structuredPayload(
        "Return a JSON object whose result is ok.",
        schema,
        "provider_probe",
      ),
    );
    const parsed = JSON.parse(
      this.outputText(result.body, result.requestId, result.httpStatus),
    ) as { result?: unknown };
    if (parsed.result !== "ok")
      throw new OpenAIProviderError(
        this.diagnostic(
          result.body,
          result.httpStatus,
          result.requestId,
          "OpenAI structured probe returned an invalid result",
        ),
      );
    return {
      probe: "structured",
      provider: this.provider,
      model: this.model,
      httpStatus: result.httpStatus,
      requestId: result.requestId,
      outputReceived: true,
    };
  }
  async probeClassifierSchema() {
    const input = JSON.stringify({
      storyId: "synthetic-probe",
      categoryContext: "public_affairs",
      translations: [
        {
          language: "en",
          headline: "Council Approves New Ferry Schedule",
          summary:
            "The Island Council approved a revised ferry schedule that adds two weekly services.",
          articleText:
            "The Island Council approved a revised ferry schedule during its Tuesday meeting. The new timetable will take effect next month and adds two additional weekly services. Council officials said the change was made after consultations with residents.",
        },
      ],
    });
    const result = await this.request(
      this.structuredPayload(
        input,
        outputSchema,
        "content_type_recommendation",
        instructions,
      ),
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        this.outputText(result.body, result.requestId, result.httpStatus),
      );
    } catch {
      throw new OpenAIProviderError(
        this.diagnostic(
          result.body,
          result.httpStatus,
          result.requestId,
          "OpenAI classifier probe returned malformed structured output",
        ),
      );
    }
    let classifierResult;
    try {
      classifierResult = validateClassifierResult(parsed);
    } catch {
      throw new OpenAIProviderError(
        this.diagnostic(
          result.body,
          result.httpStatus,
          result.requestId,
          "OpenAI classifier probe failed production validation",
        ),
      );
    }
    return {
      probe: "classifier_schema",
      provider: this.provider,
      model: this.model,
      httpStatus: result.httpStatus,
      requestId: result.requestId,
      outputReceived: true,
      validationPassed: true,
      classifierResult,
    };
  }
  async classify(story: ClassifierStory) {
    const input = JSON.stringify({
        storyId: story.storyId,
        categoryContext: story.category,
        translations: story.translations.map(
          ({ language, headline, summary, articleText }) => ({
            language,
            headline,
            summary,
            articleText,
          }),
        ),
      }),
      result = await this.request(
        this.structuredPayload(
          input,
          outputSchema,
          "content_type_recommendation",
          instructions,
        ),
      );
    this.lastRequestId = result.requestId;
    const text = this.outputText(
      result.body,
      result.requestId,
      result.httpStatus,
    );
    try {
      return JSON.parse(text);
    } catch {
      throw new OpenAIProviderError(
        this.diagnostic(
          result.body,
          result.httpStatus,
          result.requestId,
          "OpenAI provider returned malformed structured output",
        ),
      );
    }
  }
}
