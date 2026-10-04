// 記事の原稿を D1 に取り込む SQL(scripts/lib/article-import.mjs)のテスト(Issue #195 PR 3)。本物の D1 には、通信しない。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { getArticle, listArticles } from "../functions/_lib/articles-db.js";
import {
  importSql,
  insertSql,
  parseSources,
  planImport,
  sqlString,
} from "../scripts/lib/article-import.mjs";
import { loadSources } from "../scripts/lib/build.mjs";
import { createDb } from "./helpers/d1.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const NOW = 1_800_000_000;
const source = (slug, extra = "") => ({
  slug,
  text: `---\ntitle: 題名 ${slug}\ndescription: ${slug} の、取り込みテスト用の説明文です。\ndate: "2026-10-01"\n${extra}---\n\n本文の「it's」と '引用符' と\n改行です。\n`,
});

describe("sqlString", () => {
  it("単引用符を二重にする。NUL 文字は断る", () => {
    assert.equal(sqlString("it's"), "'it''s'");
    assert.throws(() => sqlString(`a${String.fromCodePoint(0)}b`), /NUL/);
  });
});

describe("parseSources・importSql", () => {
  it("原稿を検証して、D1 に入れた内容が、元の原稿と同じになる(引用符・改行・下書きを含む)", async () => {
    const articles = parseSources([
      source("one", "tags:\n  - ゲーム\n"),
      source("two", "draft: true\n"),
    ]);
    const db = createDb();
    db.exec(importSql(articles, NOW));
    const one = await getArticle(db, "one");
    assert.equal(one.title, "題名 one");
    assert.deepEqual(one.tags, ["ゲーム"]);
    assert.equal(one.draft, false);
    assert.match(one.body, /it's/);
    assert.match(one.body, /'引用符'/);
    assert.equal((await getArticle(db, "two")).draft, true);
    assert.deepEqual(
      (await listArticles(db, { publishedOnly: true })).map((a) => a.slug),
      ["one"],
    );
  });

  it("問題のある原稿は、まとめて Error にする(1 本も取り込まない)", () => {
    assert.throws(
      () => parseSources([source("ok"), { slug: "Bad_Slug", text: "---\ntitle: x\n---\n本文" }]),
      /Bad_Slug/,
    );
  });

  it("同じスラッグが、すでにあれば、上書きしない(管理画面で直した内容を消さない)", async () => {
    const db = createDb();
    const [article] = parseSources([source("keep")]);
    db.exec(insertSql(article, NOW));
    db.exec(insertSql({ ...article, title: "原稿を書き換えた題名" }, NOW + 100));
    assert.equal((await getArticle(db, "keep")).title, "題名 keep");
  });

  it("本文に「'); DROP」のような文字があっても、1 つの値として入る", async () => {
    const db = createDb();
    const [article] = parseSources([source("inj")]);
    db.exec(importSql([{ ...article, body: "x'); DROP TABLE articles; --" }], NOW));
    assert.match((await getArticle(db, "inj")).body, /DROP TABLE/);
    assert.equal((await listArticles(db)).length, 1);
  });
});

describe("planImport", () => {
  it("すでにあるスラッグは、飛ばす", () => {
    const articles = parseSources([source("a"), source("b")]);
    const { toInsert, skipped } = planImport(articles, ["a"]);
    assert.deepEqual(
      toInsert.map((x) => x.slug),
      ["b"],
    );
    assert.deepEqual(
      skipped.map((x) => x.slug),
      ["a"],
    );
  });
});

describe("実際の原稿・スクリプト", () => {
  it("content/articles の原稿が、すべて取り込める", () => {
    const articles = parseSources(loadSources(`${root}content/articles`));
    assert.ok(articles.length >= 7);
    const db = createDb();
    db.exec(importSql(articles, NOW));
  });

  it("書き込みは --yes のときだけ。SQL はリポジトリの外に作って、消す。npm のスクリプトがある", () => {
    const script = readFileSync(`${root}scripts/import-articles.mjs`, "utf8");
    assert.match(script, /options\.yes/);
    assert.match(script, /tmpdir\(\)/);
    assert.match(script, /rmSync\(dir/);
    const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));
    assert.equal(pkg.scripts["articles:import"], "node scripts/import-articles.mjs");
  });
});
