// 公開の記事ページ(GET /articles/・/articles/<スラッグ>/)を D1 から出す Functions のテスト(Issue #195 PR 3)。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { insertArticle } from "../functions/_lib/articles-db.js";
import { onRequest as anyIndex, onRequestGet as getIndex } from "../functions/articles/index.js";
import { onRequest as anyPage, onRequestGet as getPage } from "../functions/articles/[slug].js";
import { createDb } from "./helpers/d1.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const site = JSON.parse(readFileSync(`${root}public/data/site.json`, "utf8"));
const BASE = "https://nolito.test";

function makeAssets() {
  const calls = [];
  return {
    calls,
    fetch: async (url) => {
      const { pathname } = new URL(url);
      calls.push(pathname);
      if (pathname === "/data/site.json") return new Response(JSON.stringify(site));
      if (pathname === "/404.html") return new Response("<h1>見つかりません</h1>");
      return new Response(`静的: ${pathname}`);
    },
  };
}

const article = (over = {}) => ({
  slug: "hello",
  title: "はじめての記事",
  description: "D1 から出す記事ページの、テスト用の説明文です。",
  date: "2026-10-01",
  updated: null,
  tags: ["テスト"],
  draft: false,
  body: "## 見出し\n\n本文です。<script>alert(1)</script>",
  ...over,
});

async function setup(articles) {
  const db = createDb();
  for (const item of articles) await insertArticle(db, item, 1_800_000_000);
  return { db, assets: makeAssets() };
}

const page = (env, slug) =>
  getPage({ env, request: new Request(`${BASE}/articles/${slug}/`), params: { slug } });
const index = (env) => getIndex({ env, request: new Request(`${BASE}/articles/`), params: {} });

describe("GET /articles/<スラッグ>/(D1 から)", () => {
  it("公開の記事を、HTML で返す。本文の生の HTML は、実行せず文字にする", async () => {
    const { db, assets } = await setup([article()]);
    const response = await page({ DB: db, ASSETS: assets }, "hello");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    const html = await response.text();
    assert.match(html, /はじめての記事/);
    assert.match(html, /<h2[^>]*>見出し<\/h2>/);
    assert.ok(!html.includes("<script>alert(1)"), "生の script が出ている");
  });

  it("下書き・ない記事・形の悪いスラッグは 404(404 ページ。保存させない)", async () => {
    const { db, assets } = await setup([article({ slug: "draft-one", draft: true })]);
    const env = { DB: db, ASSETS: assets };
    for (const slug of ["draft-one", "nothing", "Bad_Slug", "../x"]) {
      const response = await page(env, slug);
      assert.equal(response.status, 404, slug);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.match(await response.text(), /見つかりません/);
    }
  });

  it("D1 の内容を直すと、すぐ反映される(静的な生成を待たない)", async () => {
    const { db, assets } = await setup([article()]);
    await db
      .prepare("UPDATE articles SET title = ? WHERE slug = ?")
      .bind("直した題名", "hello")
      .run();
    const html = await (await page({ DB: db, ASSETS: assets }, "hello")).text();
    assert.match(html, /直した題名/);
  });
});

describe("GET /articles/(D1 から)", () => {
  it("公開の記事だけを、新しい順に並べる(下書きは出さない)", async () => {
    const { db, assets } = await setup([
      article({ slug: "old", title: "古い記事", date: "2026-09-01" }),
      article({ slug: "new", title: "新しい記事", date: "2026-10-02" }),
      article({ slug: "secret", title: "下書きの記事", draft: true }),
    ]);
    const html = await (await index({ DB: db, ASSETS: assets })).text();
    assert.ok(html.indexOf("新しい記事") > 0);
    assert.ok(html.indexOf("新しい記事") < html.indexOf("古い記事"));
    assert.ok(!html.includes("下書きの記事"));
  });

  it("記事が 0 本でも、落ちない", async () => {
    const { db, assets } = await setup([]);
    assert.equal((await index({ DB: db, ASSETS: assets })).status, 200);
  });
});

describe("D1 がない環境(プレビューなど)・そのほか", () => {
  it("ASSETS の静的な写し(/articles-static/)を返す", async () => {
    const assets = makeAssets();
    const env = { ASSETS: assets };
    assert.equal(await (await index(env)).text(), "静的: /articles-static/");
    assert.equal(await (await page(env, "hello")).text(), "静的: /articles-static/hello/");
  });

  it("D1 がなくても、形の悪いスラッグは、静的な写しに渡さず 404", async () => {
    const assets = makeAssets();
    const response = await page({ ASSETS: assets }, "Bad_Slug");
    assert.equal(response.status, 404);
    assert.ok(!assets.calls.some((path) => path.startsWith("/articles-static")));
  });

  it("ASSETS がなければ 503。GET 以外は 405", async () => {
    assert.equal((await index({})).status, 503);
    assert.equal((await page({}, "hello")).status, 503);
    const post = new Request(`${BASE}/articles/`, { method: "POST" });
    assert.equal((await anyIndex({ env: {}, request: post })).status, 405);
    assert.equal((await anyPage({ env: {}, request: post })).status, 405);
  });
});

describe("静的な写し(public/articles-static/)", () => {
  it("生成物があり、元の /articles/ には静的ファイルを置かない(Functions が隠れないように)", () => {
    const read = (path) => readFileSync(`${root}${path}`, "utf8");
    assert.match(read("public/articles-static/index.html"), /<html/);
    assert.throws(() => read("public/articles/index.html"));
  });
});
