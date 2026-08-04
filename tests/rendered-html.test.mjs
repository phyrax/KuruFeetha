import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships Supabase identity, protected editorial APIs, and personalized feeds", async () => {
  const [page, shell, ingestion, feed, auth, users, mobile] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/KuruFeethaApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/admin/ingest/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/feed/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/admin/users/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../mobile/app/index.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /KuruFeethaApp/);
  assert.match(shell, /Maldives, in brief/);
  assert.match(shell, /api\/v1\/admin\/ingest/);
  assert.match(ingestion, /generateWithFallback/);
  assert.match(ingestion, /requireAdmin/);
  assert.match(feed, /review_status = 'approved'/);
  assert.match(feed, /followed DESC/);
  assert.match(auth, /status === "suspended"/);
  assert.match(auth, /OWNER_EMAIL/);
  assert.match(users, /requireAdmin/);
  assert.match(users, /PROTECTED_ACCOUNT/);
  assert.match(mobile, /supabase/);
  assert.match(mobile, /access_token/);
  await access(new URL("../dist/server/index.js", import.meta.url));
});
