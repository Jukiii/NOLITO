import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SMOKE_CHECKS, SLOW_MS, normalizeBase, runSmoke } from "../scripts/lib/smoke.mjs";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

function reply(body, { status = 200, type = "text/html; charset=utf-8", headers = {} } = {}) {
  return new Response(body, { status, headers: { "content-type": type, ...headers } });
}

// 健全なサイトを装う fetch
function healthyFetch(url) {
  const { pathname } = new URL(url);
  if (pathname === "/__smoke-not-found__/") return reply("not found", { status: 404 });
  if (pathname === "/api/me") return reply('{"enabled":false}', { type: "application/json" });
  if (pathname === "/api/products")
    return reply('{"version":5,"products":[]}', { type: "application/json" });
  if (pathname === "/api/affiliates")
    return reply('{"version":1,"links":[]}', { type: "application/json" });
  if (pathname.endsWith(".json")) return reply("{}", { type: "application/json" });
  if (pathname === "/favicon.svg") {
    return reply("<svg/>", {
      type: "image/svg+xml",
      headers: { "cache-control": "public, max-age=86400" },
    });
  }
  return reply("<html></html>", {
    headers: { "x-content-type-options": "nosniff", "x-frame-options": "DENY" },
  });
}

test("チェックする静的なページは、実際にある", () => {
  for (const check of SMOKE_CHECKS) {
    if (check.status === 404 || check.path.startsWith("/api/")) continue;
    // /articles/ は Functions が出す。静的な写しの有無で確かめる
    const path = check.path.replace("/articles/", "/articles-static/");
    const relative = path.endsWith("/") ? `${path}index.html` : path;
    assert.ok(existsSync(`${publicDir}${relative.slice(1)}`), `${check.path} がありません`);
  }
});

test("健全なサイトは、すべて合格する", async () => {
  const results = await runSmoke("https://example.test", {
    fetchFn: async (url) => healthyFetch(url),
  });
  assert.equal(results.length, SMOKE_CHECKS.length);
  assert.deepEqual(
    results.filter((r) => !r.ok),
    [],
  );
});

test("ステータス・JSON の形・ヘッダー・同意前の Google 読み込みの問題を、検出する", async () => {
  const broken = async (url) => {
    const { pathname } = new URL(url);
    if (pathname === "/")
      return reply('<script src="https://www.googletagmanager.com/gtag/js"></script>');
    if (pathname === "/updates/") return reply("boom", { status: 500 });
    if (pathname === "/api/me") return reply("<html>error</html>", { type: "application/json" });
    if (pathname === "/api/products") return reply("{}", { type: "application/json" });
    if (pathname === "/favicon.svg") return reply("<svg/>", { type: "image/svg+xml" });
    if (pathname === "/__smoke-not-found__/") return reply("<html></html>");
    return healthyFetch(url);
  };
  const results = await runSmoke("https://example.test", { fetchFn: broken });
  const failed = new Map(results.filter((r) => !r.ok).map((r) => [r.path, r.problems.join(" / ")]));
  assert.match(failed.get("/"), /googletagmanager/);
  assert.match(failed.get("/updates/"), /500/);
  assert.match(failed.get("/api/me"), /JSON として読めません/);
  assert.match(failed.get("/api/products"), /形が想定と違います/);
  assert.match(failed.get("/favicon.svg"), /cache-control/);
  assert.match(failed.get("/__smoke-not-found__/"), /200/);
});

test("接続できないときも、落ちず、問題として報告する", async () => {
  const results = await runSmoke("https://example.test", {
    fetchFn: async () => {
      throw new Error("offline");
    },
  });
  assert.ok(results.every((r) => !r.ok && /接続できません/.test(r.problems[0])));
});

test("遅いページは、印を付ける(失敗にはしない)", async () => {
  let tick = 0;
  const results = await runSmoke("https://example.test", {
    fetchFn: async (url) => healthyFetch(url),
    now: () => (tick += SLOW_MS + 1),
    checks: [{ path: "/", type: "text/html" }],
  });
  assert.equal(results[0].ok, true);
  assert.equal(results[0].slow, true);
});

test("リダイレクトは追わない(意図しない転送を、見逃さない)", async () => {
  const results = await runSmoke("https://example.test", {
    fetchFn: async () =>
      new Response(null, { status: 302, headers: { location: "https://evil.test/" } }),
    checks: [{ path: "/" }],
  });
  assert.equal(results[0].ok, false);
  assert.match(results[0].problems[0], /302/);
});

test("URL は https(手元の確認は localhost)だけ", () => {
  assert.equal(normalizeBase("https://nolito.pages.dev/games/"), "https://nolito.pages.dev");
  assert.equal(normalizeBase("http://localhost:8788"), "http://localhost:8788");
  assert.throws(() => normalizeBase("http://nolito.pages.dev"), /https/);
  assert.throws(() => normalizeBase("nolito"), /形が違います/);
});

test("運用の手順書が、実在するファイル・コマンド・設定を指している", async () => {
  const { readFileSync } = await import("node:fs");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const doc = readFileSync(`${root}docs/operations.md`, "utf8");
  const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));
  for (const [, file] of doc.matchAll(/`(docs\/[\w./-]+\.md)`/g)) {
    assert.ok(existsSync(`${root}${file}`), `${file} がありません`);
  }
  for (const [, script] of doc.matchAll(/npm run ([\w:-]+)/g)) {
    assert.ok(pkg.scripts[script], `npm run ${script} がありません`);
  }
  const config = readFileSync(`${root}functions/_lib/config.js`, "utf8");
  for (const name of ["AUTH_ENABLED", "CONTACT_ENABLED", "SIGNUP_MODE", "ALLOWED_EMAILS"]) {
    assert.ok(doc.includes(name) && config.includes(name), `${name} が、手順書か設定にありません`);
  }
});
