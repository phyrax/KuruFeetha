import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  OpenAIContentTypeProvider,
  OpenAIProviderError,
  providerDiagnostic,
} from "../app/lib/openai-content-type-provider.ts";

const key = "sk-test-secret-never-log";
const response = (body, { status = 200, requestId = "req_safe" } = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": requestId },
  });
async function withFetch(implementation, work) {
  const original = globalThis.fetch;
  globalThis.fetch = implementation;
  try {
    return await work();
  } finally {
    globalThis.fetch = original;
  }
}
function diagnosticFrom(error) {
  assert.ok(error instanceof OpenAIProviderError);
  const value = providerDiagnostic(error);
  assert.ok(value);
  return value;
}

test("400 provider errors expose only sanitized diagnostics", async () =>
  withFetch(
    async () =>
      response(
        {
          error: {
            type: "invalid_request_error",
            code: "invalid_parameter",
            message: "Unsupported schema",
          },
        },
        { status: 400, requestId: "req_400" },
      ),
    async () => {
      const provider = new OpenAIContentTypeProvider({ OPENAI_API_KEY: key });
      await assert.rejects(provider.probePlain(), (error) => {
        const item = diagnosticFrom(error);
        assert.deepEqual(
          {
            status: item.httpStatus,
            type: item.errorType,
            code: item.errorCode,
            requestId: item.requestId,
          },
          {
            status: 400,
            type: "invalid_request_error",
            code: "invalid_parameter",
            requestId: "req_400",
          },
        );
        assert.equal(item.message, "Unsupported schema");
        return true;
      });
    },
  ));

test("401 diagnostics never leak credentials or Authorization", async () =>
  withFetch(
    async (_url, init) =>
      response(
        {
          error: {
            type: "invalid_request_error",
            code: "invalid_api_key",
            message: `Incorrect API key ${init.headers.authorization}`,
          },
        },
        { status: 401 },
      ),
    async () => {
      const provider = new OpenAIContentTypeProvider({ OPENAI_API_KEY: key });
      await assert.rejects(provider.probePlain(), (error) => {
        const serialized = JSON.stringify(diagnosticFrom(error));
        assert.doesNotMatch(serialized, /sk-test-secret|Bearer\s+sk-/);
        assert.match(serialized, /REDACTED/);
        return true;
      });
    },
  ));

test("429 rate-limit errors retain safe status and provider code", async () =>
  withFetch(
    async () =>
      response(
        {
          error: {
            type: "rate_limit_error",
            code: "rate_limit_exceeded",
            message: "Rate limit reached",
          },
        },
        { status: 429, requestId: "req_429" },
      ),
    async () => {
      const provider = new OpenAIContentTypeProvider({ OPENAI_API_KEY: key });
      await assert.rejects(provider.probePlain(), (error) => {
        const item = diagnosticFrom(error);
        assert.equal(item.httpStatus, 429);
        assert.equal(item.errorCode, "rate_limit_exceeded");
        assert.equal(item.requestId, "req_429");
        return true;
      });
    },
  ));

test("HTTP 200 response status failed is treated as a provider failure", async () =>
  withFetch(
    async () =>
      response(
        {
          status: "failed",
          error: {
            type: "server_error",
            code: "response_failed",
            message: "Generation failed",
          },
        },
        { requestId: "req_failed" },
      ),
    async () => {
      const provider = new OpenAIContentTypeProvider({ OPENAI_API_KEY: key });
      await assert.rejects(provider.probePlain(), (error) => {
        const item = diagnosticFrom(error);
        assert.equal(item.responseStatus, "failed");
        assert.equal(item.errorCode, "response_failed");
        return true;
      });
    },
  ));

test("incomplete Responses API objects surface the incomplete reason", async () =>
  withFetch(
    async () =>
      response(
        {
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
        },
        { requestId: "req_incomplete" },
      ),
    async () => {
      const provider = new OpenAIContentTypeProvider({ OPENAI_API_KEY: key });
      await assert.rejects(provider.probePlain(), (error) => {
        const item = diagnosticFrom(error);
        assert.equal(item.responseStatus, "incomplete");
        assert.equal(item.incompleteReason, "max_output_tokens");
        assert.match(item.message, /incomplete/i);
        return true;
      });
    },
  ));

test("successful probes capture the OpenAI request ID", async () =>
  withFetch(
    async () =>
      response(
        { status: "completed", output_text: "OK" },
        { requestId: "req_success" },
      ),
    async () => {
      const result = await new OpenAIContentTypeProvider({
        OPENAI_API_KEY: key,
      }).probePlain();
      assert.equal(result.requestId, "req_success");
      assert.equal(result.httpStatus, 200);
    },
  ));

test("diagnostics and source logging omit authorization and article bodies", async () => {
  const source = await readFile(
      new URL("../app/lib/openai-content-type-provider.ts", import.meta.url),
      "utf8",
    ),
    route = await readFile(
      new URL(
        "../app/api/v1/admin/content-classification/probe/route.ts",
        import.meta.url,
      ),
      "utf8",
    );
  assert.doesNotMatch(
    route,
    /console\.(?:error|log)\([^\n]*(?:articleText|authorization|OPENAI_API_KEY)/i,
  );
  assert.doesNotMatch(source, /diagnostic\([^\n]*articleText/);
  assert.match(source, /Bearer \[REDACTED\]/);
});

test("malformed structured output is rejected safely", async () =>
  withFetch(
    async () => response({ status: "completed", output_text: "not-json" }),
    async () => {
      const provider = new OpenAIContentTypeProvider({ OPENAI_API_KEY: key });
      await assert.rejects(
        provider.classify({
          storyId: "synthetic",
          category: null,
          translations: [],
        }),
        (error) => {
          assert.match(
            diagnosticFrom(error).message,
            /malformed structured output/,
          );
          return true;
        },
      );
    },
  ));

test("valid structured classifier output remains accepted", async () =>
  withFetch(
    async () =>
      response(
        {
          status: "completed",
          output_text: JSON.stringify({
            schemaVersion: "2.0",
            recommendedType: "news",
            confidence: 0.98,
            reason: "Synthetic factual report.",
            needsHumanReview: false,
            flags: [],
            languageRecommendations: { en: "news", dv: null },
          }),
        },
        { requestId: "req_valid" },
      ),
    async () => {
      const result = await new OpenAIContentTypeProvider({
        OPENAI_API_KEY: key,
      }).classify({ storyId: "synthetic", category: null, translations: [] });
      assert.equal(result.recommendedType, "news");
    },
  ));

test("successful classifier calls retain only the safe OpenAI request ID", async () =>
  withFetch(
    async () =>
      response(
        {
          status: "completed",
          output_text: JSON.stringify({
            schemaVersion: "2.0",
            recommendedType: "news",
            confidence: 0.98,
            reason: "Synthetic factual report.",
            needsHumanReview: false,
            flags: [],
            languageRecommendations: { en: "news", dv: null },
          }),
        },
        { requestId: "req_classifier_success" },
      ),
    async () => {
      const provider = new OpenAIContentTypeProvider({ OPENAI_API_KEY: key });
      await provider.classify({
        storyId: "synthetic",
        category: null,
        translations: [],
      });
      assert.equal(provider.lastRequestId, "req_classifier_success");
    },
  ));

test("classifier schema probe uses the production validator and returns its parsed synthetic result", async () =>
  withFetch(
    async (_url, init) => {
      const payload = JSON.parse(init.body);
      assert.equal(payload.model, "gpt-5.4-nano");
      assert.equal(payload.text.format.name, "content_type_recommendation");
      assert.equal(payload.text.format.strict, true);
      assert.deepEqual(payload.text.format.schema.properties.schemaVersion.enum, [
        "2.0",
      ]);
      assert.equal(
        payload.text.format.schema.properties.flags.items.additionalProperties,
        false,
      );
      assert.ok(
        payload.text.format.schema.properties.flags.items.properties.code.enum.includes(
          "NEWS_PRESS_RELEASE_UNCERTAINTY",
        ),
      );
      assert.match(payload.instructions, /Confidence means certainty/);
      assert.match(payload.instructions, /0\.95–1\.00/);
      assert.match(payload.instructions, /Do not lower content-type confidence/);
      assert.match(payload.input, /Council Approves New Ferry Schedule/);
      return response(
        {
          status: "completed",
          output_text: JSON.stringify({
            schemaVersion: "2.0",
            recommendedType: "news",
            confidence: 0.99,
            reason:
              "The article neutrally reports a council decision and its implementation details.",
            needsHumanReview: false,
            flags: [],
            languageRecommendations: { en: "news", dv: null },
          }),
        },
        { requestId: "req_probe_c" },
      );
    },
    async () => {
      const result = await new OpenAIContentTypeProvider({
        OPENAI_API_KEY: key,
        CONTENT_CLASSIFIER_MODEL: "gpt-5.4-nano",
      }).probeClassifierSchema();
      assert.equal(result.httpStatus, 200);
      assert.equal(result.requestId, "req_probe_c");
      assert.equal(result.validationPassed, true);
      assert.equal(result.classifierResult.recommendedType, "news");
      assert.deepEqual(result.classifierResult.languageRecommendations, {
        en: "news",
        dv: null,
      });
      assert.deepEqual(result.classifierResult.flags, []);
    },
  ));

test("classifier schema probe rejects output that fails the production validator", async () =>
  withFetch(
    async () =>
      response(
        {
          status: "completed",
          output_text: JSON.stringify({
            schemaVersion: "2.0",
            recommendedType: "news",
            confidence: 2,
            reason: "Invalid confidence",
            needsHumanReview: false,
            flags: [],
            languageRecommendations: { en: "news", dv: null },
          }),
        },
        { requestId: "req_probe_c_invalid" },
      ),
    async () => {
      const provider = new OpenAIContentTypeProvider({ OPENAI_API_KEY: key });
      await assert.rejects(
        () => provider.probeClassifierSchema(),
        (error) =>
          error instanceof OpenAIProviderError &&
          error.diagnostic.message ===
            "OpenAI classifier probe failed production validation",
      );
    },
  ));

test("diagnostic routes are admin-only probes with no editorial write path", async () => {
  const [probe, analyze] = await Promise.all([
    readFile(
      new URL(
        "../app/api/v1/admin/content-classification/probe/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/api/v1/admin/content-classification/analyze/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(probe, /requireAdmin\(request\)/);
  assert.doesNotMatch(
    probe,
    /UPDATE\s+news_card_translations|content_type\s*=/i,
  );
  assert.doesNotMatch(
    analyze,
    /UPDATE\s+news_card_translations|updateContentTypeOnly/i,
  );
});
