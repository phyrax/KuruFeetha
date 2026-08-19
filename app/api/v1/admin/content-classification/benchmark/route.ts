import { env } from "cloudflare:workers";
import { authErrorResponse, requireAdmin } from "../../../../../lib/auth";
import {
  balancedBenchmark,
  runBalancedBenchmark,
} from "../../../../../lib/content-type-benchmark";
import {
  OpenAIContentTypeProvider,
  providerDiagnostic,
} from "../../../../../lib/openai-content-type-provider";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
  } catch (error) {
    return authErrorResponse(error);
  }
  const body = (await request.json().catch(() => null)) as {
      dataset?: string;
    } | null;
  if (body?.dataset !== balancedBenchmark.version)
    return Response.json(
      {
        error: {
          code: "INVALID_BENCHMARK_DATASET",
          message: `Choose ${balancedBenchmark.version}`,
        },
      },
      { status: 400 },
    );
  const runtime = env as unknown as {
      OPENAI_API_KEY?: string;
      CONTENT_CLASSIFIER_MODEL?: string;
    },
    provider = new OpenAIContentTypeProvider(runtime);
  if (provider.model !== balancedBenchmark.model)
    return Response.json(
      {
        error: {
          code: "BENCHMARK_MODEL_MISMATCH",
          message: `Benchmark requires ${balancedBenchmark.model}`,
        },
      },
      { status: 409 },
    );
  try {
    const started = Date.now(),
      report = await runBalancedBenchmark(provider, (result) =>
        console.info("OPENAI_BALANCED_BENCHMARK_CASE", {
          benchmarkId: result.benchmarkId,
          requestId: result.requestId,
          model: provider.model,
          latencyMs: result.latencyMs,
        }),
      );
    return Response.json(
      {
        dataset: balancedBenchmark.version,
        promptVersion: balancedBenchmark.promptVersion,
        schemaVersion: balancedBenchmark.schemaVersion,
        model: provider.model,
        durationMs: Date.now() - started,
        ...report,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const diagnostic = providerDiagnostic(error);
    return Response.json(
      {
        error:
          diagnostic ??
          ({
            code: "BENCHMARK_FAILED",
            message: error instanceof Error ? error.message : "Benchmark failed",
          } as const),
      },
      { status: diagnostic?.httpStatus ?? 500 },
    );
  }
}
