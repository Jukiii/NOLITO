import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { insertArticle } from "../functions/_lib/articles-db.js";
import { onRequest, onRequestGet } from "../functions/sitemap.xml.js";
import { createDb } from "./helpers/d1.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const site = JSON.parse(readFileSync(`${root}public/data/site.json`, "utf8"));
const base = "https://nolito.test";

const article = (slug, draft = false) => ({
  slug,
  title: "テスト記事",
  description: "テスト用の記事説明です。",
  date: "2026-10-04",
  updated: null,
  tags: [],
  draft,
  body: "本文です。",
});

function makeAssets(articles = []) {
  return {
    fetch: async (url) => {
      const { pathname } = new URL(url);
      if (pathname === "/data/site.json") return new Response(JSON.stringify(site));
      if (pathname === "/data/articles.json") return new Response(JSON.stringify({ articles }));
      return new Response("not found", { status: 404 });
    },
  };
}

describe("検索エンジン向けの基本情報", () => {
  it("robots.txt からサイトマップを案内する", () => {
    const robots = readFileSync(`${root}public/robots.txt`, "utf8");
    assert.match(
      robots,
      /^User-agent: \*\nAllow: \/\nSitemap: https:\/\/nolito-jukiii\.com\/sitemap\.xml\n$/,
    );
  });

  it("サイトマップに公開ページと公開記事だけを載せ、noindex と静的な写しを除く", async () => {
    const db = createDb();
    await insertArticle(db, article("published"), 1);
    await insertArticle(db, article("draft", true), 1);
    const response = await onRequestGet({
      env: { ASSETS: makeAssets(), DB: db },
      request: new Request(`${base}/sitemap.xml`),
    });
    const xml = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/xml/);
    assert.match(xml, /https:\/\/nolito-jukiii\.com\/games\/escape-boss\//);
    assert.match(xml, /https:\/\/nolito-jukiii\.com\/articles\/published\//);
    assert.doesNotMatch(xml, /\/articles\/draft\//);
    assert.doesNotMatch(xml, /\/account\/|\/profile\/|\/stats\/|articles-static/);
  });

  it("D1 がない環境では公開記事 JSON を使い、不正な slug を除く", async () => {
    const response = await onRequestGet({
      env: {
        ASSETS: makeAssets([{ slug: "preview-article" }, { slug: "../private" }, null]),
      },
      request: new Request(`${base}/sitemap.xml`),
    });
    const xml = await response.text();

    assert.equal(response.status, 200);
    assert.match(xml, /\/articles\/preview-article\//);
    assert.doesNotMatch(xml, /private/);
  });

  it("GET 以外は許可しない", async () => {
    const response = await onRequest({
      env: {},
      request: new Request(`${base}/sitemap.xml`, { method: "POST" }),
    });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET");
  });

  it("sitemap の固定ページは、noindex でなく title・description・canonical がある", () => {
    const publicPaths = [
      "/",
      "/about/",
      "/ads-policy/",
      "/games/",
      "/games/escape-boss/",
      "/games/escape-boss/about/",
      "/games/escape-boss/glossary/",
      "/privacy/",
      "/search/",
      "/software/",
      "/support/",
      "/terms/",
      "/tools/",
      "/tools/kii-michi/",
      "/tools/kii-michi/about/",
      "/updates/",
    ];
    for (const path of publicPaths) {
      const filePath = path === "/" ? "public/index.html" : `public${path}index.html`;
      const html = readFileSync(`${root}${filePath}`, "utf8");
      assert.match(html, /<title>[^<]+<\/title>/, path);
      assert.match(html, /<meta\s+name="description"/, path);
      const canonical = /<link\s+rel="canonical"\s+href="([^"]+)"/.exec(html);
      assert.ok(canonical, path);
      assert.equal(canonical[1], new URL(path, site.url).href, path);
      assert.doesNotMatch(html, /<meta\s+name="robots"\s+content="noindex"/, path);
    }
  });
});
