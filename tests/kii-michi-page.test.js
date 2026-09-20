import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { TABS } from "../public/assets/js/tools/kii-michi/view.js";

const read = (path) =>
  readFileSync(fileURLToPath(new URL(`../public/${path}`, import.meta.url)), "utf8");
const html = read("tools/kii-michi/index.html");
const attr = (tag, name) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];

describe("キーみちのページの構造", () => {
  const tabs = [...html.matchAll(/<button\b[^>]*role="tab"[^>]*>/g)].map((m) => m[0]);
  const panels = [...html.matchAll(/<section\b[^>]*role="tabpanel"[^>]*>/g)].map((m) => m[0]);

  it("タブと、画面の切り替え(view.js の TABS)が、一致している", () => {
    assert.deepEqual(
      tabs.map((tag) => attr(tag, "data-tab")),
      TABS,
    );
    assert.deepEqual(
      panels.map((tag) => attr(tag, "data-panel")),
      TABS,
    );
  });

  it("タブ・パネルの id と aria の対応が、正しい(タブ ↔ パネル)", () => {
    for (const name of TABS) {
      const tab = tabs.find((tag) => attr(tag, "data-tab") === name);
      const panel = panels.find((tag) => attr(tag, "data-panel") === name);
      assert.equal(attr(tab, "id"), `tab-${name}`);
      assert.equal(attr(tab, "aria-controls"), attr(panel, "id"));
      assert.equal(attr(panel, "aria-labelledby"), attr(tab, "id"));
    }
  });

  it("タブ・パネルは、JavaScript が描くまで、隠れている(タブは、JavaScript がないと使えない)", () => {
    assert.match(html, /role="tablist"[^>]*\bhidden\b/);
    for (const panel of panels) assert.match(panel, /\bhidden\b/);
  });

  it("スクリーンリーダー向けの通知・案内の場所、確認のダイアログ、JavaScript なしの案内がある", () => {
    assert.match(html, /role="status"[^>]*data-announce/);
    assert.match(html, /role="status"[^>]*data-notice/);
    assert.match(html, /<dialog[^>]*data-confirm/);
    assert.match(html, /<noscript>[\s\S]*JavaScript が必要/);
    assert.equal(html.match(/<h1[ >]/g).length, 1);
  });

  it("広告の枠は置かない(操作の画面)", () => {
    assert.ok(!html.includes("data-ad-slot"));
  });

  it("必要な CSS・スクリプトを読み込む", () => {
    assert.ok(html.includes('href="/assets/css/kii-michi.css"'));
    assert.ok(html.includes('src="/assets/js/tools/kii-michi/main.js"'));
    assert.ok(html.includes('src="/assets/js/main.js"'));
  });
});

describe("キーみちの公開の情報", () => {
  it("プライバシーポリシーの「端末内に保存する情報」に、ツールの記載がある", () => {
    const privacy = read("privacy/index.html");
    assert.match(privacy, /ツール[\s\S]{0,40}キーみち[\s\S]{0,400}送信されません/);
  });

  it("サイト紹介から、キーみちへリンクしている", () => {
    assert.ok(read("about/index.html").includes('href="/tools/kii-michi/"'));
  });
});
