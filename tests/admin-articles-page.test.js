// 記事の管理画面(Issue #195 PR 2)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseTags } from "../public/assets/js/admin/article-form.js";
import { ALLOWED, isSafeHref, isSafeImageSrc } from "../public/assets/js/admin/preview.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

describe("記事の管理画面: HTML とスクリプトの対応", () => {
  const html = read("public/account/admin/articles/index.html");
  const script = read("public/assets/js/admin/articles-page.js");

  it("スクリプトが探す data-admin-articles-* は、すべて HTML にある", () => {
    const wanted = new Set(
      [...script.matchAll(/\[(data-admin-articles-[a-z-]+)\]/g)].map((match) => match[1]),
    );
    assert.ok(wanted.size >= 10);
    for (const name of wanted) assert.ok(html.includes(name), name);
    assert.ok(html.includes('name="admin-articles-draft"'));
    assert.ok(html.includes('id="admin-article-delete-dialog"'));
  });

  it("noindex で、管理画面のトップへ戻れる", () => {
    assert.match(html, /<meta name="robots" content="noindex"/);
    assert.ok(html.includes('href="/account/admin/"'));
  });

  it("画面の文字は、HTML を解釈する方法で入れない", () => {
    for (const path of [
      "public/assets/js/admin/articles-page.js",
      "public/assets/js/admin/preview.js",
      "public/assets/js/admin/article-form.js",
    ]) {
      assert.doesNotMatch(
        read(path),
        /innerHTML|outerHTML|insertAdjacentHTML|document\.write/,
        path,
      );
    }
  });

  it("削除は、再認証の案内を出す", () => {
    assert.ok(script.includes("reauth-required"));
    assert.ok(html.includes("/auth/google/login?reauth=1"));
  });
});

describe("記事の管理画面: タグの入力", () => {
  it("読点・カンマ・全角カンマで区切り、空白と空の項目を除く", () => {
    assert.deepEqual(parseTags("ゲーム、 タイピング,  ツール，"), [
      "ゲーム",
      "タイピング",
      "ツール",
    ]);
    assert.deepEqual(parseTags(""), []);
    assert.deepEqual(parseTags("、、 ,"), []);
  });
});

describe("記事の管理画面: プレビューの許可", () => {
  it("許可する要素に、実行・読み込み・スタイルに関わるものと、on で始まる属性はない", () => {
    for (const tag of ["script", "iframe", "style", "object", "embed", "link", "form", "svg"]) {
      assert.equal(Object.hasOwn(ALLOWED, tag), false, tag);
    }
    for (const [tag, attributes] of Object.entries(ALLOWED)) {
      for (const name of attributes) {
        assert.doesNotMatch(name, /^on/i, `${tag}.${name}`);
        assert.notEqual(name, "style", tag);
      }
    }
  });

  it("リンク: サイト内・#・http・https・mailto だけ", () => {
    for (const ok of [
      "/articles/",
      "#top",
      "./a",
      "https://example.com/",
      "http://example.com/",
      "mailto:a@example.com",
      "a/b",
    ]) {
      assert.equal(isSafeHref(ok), true, ok);
    }
    for (const ng of [
      "",
      "javascript:alert(1)",
      "JaVaScRiPt:1",
      "data:text/html,x",
      "vbscript:x",
      "//evil.example/",
      "java\nscript:1",
    ]) {
      assert.equal(isSafeHref(ng), false, JSON.stringify(ng));
    }
  });

  it("画像: サイト内と https だけ(mailto・http・data は不可)", () => {
    for (const ok of ["/assets/img/a.png", "./a.png", "https://example.com/a.png"]) {
      assert.equal(isSafeImageSrc(ok), true, ok);
    }
    for (const ng of [
      "",
      "http://example.com/a.png",
      "data:image/png;base64,AA",
      "javascript:1",
      "//evil.example/a.png",
      "mailto:a@example.com",
    ]) {
      assert.equal(isSafeImageSrc(ng), false, JSON.stringify(ng));
    }
  });
});
