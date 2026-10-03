// キャッシュ制御(Phase 28 PR1)・セキュリティ用のヘッダー(Issue #191)のテスト。public/_headers の形を検査する。
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const text = readFileSync(`${root}public/_headers`, "utf8").replaceAll("\r\n", "\n");

// Cloudflare Pages の _headers: 「パス」の行のあと、字下げした「名前: 値」の行が続く。空行で区切る
function parse(source) {
  const rules = [];
  let current = null;
  for (const line of source.split("\n")) {
    if (line.trim() === "") {
      current = null;
    } else if (!/^\s/.test(line)) {
      current = { path: line.trim(), headers: {} };
      rules.push(current);
    } else {
      assert.ok(current, `パスの前にヘッダーがある: ${line}`);
      const at = line.indexOf(":");
      assert.ok(at > 0, `ヘッダーの形が違う: ${line}`);
      current.headers[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
    }
  }
  return rules;
}

const allRules = parse(text);
const securityRule = allRules.find((rule) => rule.path === "/*");
const noindexRule = allRules.find((rule) => rule.path === "/articles-static/*");
const rules = allRules.filter((rule) => rule.path !== "/*" && rule !== noindexRule);

describe("public/_headers: セキュリティ用のヘッダー(全ページ。Issue #189 の案 A・Issue #191)", () => {
  it("全ページ(/*)に、4 つのヘッダーだけを付ける(CSP は、広告事業者を決めてから)", () => {
    assert.ok(securityRule, "/* の規則がありません");
    assert.deepEqual(Object.keys(securityRule.headers).sort(), [
      "permissions-policy",
      "referrer-policy",
      "x-content-type-options",
      "x-frame-options",
    ]);
  });

  it("値は、nosniff・DENY・strict-origin-when-cross-origin", () => {
    assert.equal(securityRule.headers["x-content-type-options"], "nosniff");
    assert.equal(securityRule.headers["x-frame-options"], "DENY");
    assert.equal(securityRule.headers["referrer-policy"], "strict-origin-when-cross-origin");
  });

  it("Permissions-Policy は、カメラ・マイク・位置情報を、だれにも許さない", () => {
    const value = securityRule.headers["permissions-policy"];
    for (const name of ["camera", "microphone", "geolocation"]) {
      assert.match(value, new RegExp(`${name}=\\(\\)`));
    }
  });

  it("サイトの中に、iframe がない(X-Frame-Options: DENY と矛盾しない)", () => {
    const found = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (/\.(html|js)$/.test(entry.name) && /<iframe/i.test(readFileSync(path, "utf8")))
          found.push(path);
      }
    };
    walk(`${root}public`);
    assert.deepEqual(found, []);
  });
});

describe("public/_headers: 記事の静的な写し(D1 のない環境のフォールバック。Issue #195 PR 3)", () => {
  it("検索に出さない(本物の記事ページは、D1 から出す /articles/)", () => {
    assert.ok(noindexRule, "/articles-static/* の規則がありません");
    assert.deepEqual(noindexRule.headers, { "x-robots-tag": "noindex" });
  });
});

describe("public/_headers", () => {
  it("パスは / 始まり、ヘッダーは Cache-Control だけ", () => {
    assert.ok(rules.length > 0);
    for (const rule of rules) {
      assert.match(rule.path, /^\//);
      assert.deepEqual(Object.keys(rule.headers), ["cache-control"]);
    }
  });

  it("長く持たせるのは、画像(/assets/img/ と favicon)だけ", () => {
    assert.deepEqual(rules.map((rule) => rule.path).sort(), ["/assets/img/*", "/favicon.svg"]);
  });

  it("画像の期限は、1 日(画面を撮り直したとき、古い絵が長く残らない)", () => {
    for (const rule of rules) {
      const value = rule.headers["cache-control"];
      assert.match(value, /^public, /);
      assert.equal(Number(/max-age=(\d+)/.exec(value)[1]), 86400);
      assert.doesNotMatch(value, /immutable/);
    }
  });

  it("JS・CSS・HTML・データ・API には、期限を付けない(いつでも再検証。ファイル名に版がないため)", () => {
    for (const rule of rules) {
      const inImages = rule.path === "/favicon.svg" || rule.path.startsWith("/assets/img/");
      assert.ok(inImages, `画像以外に期限を付けている: ${rule.path}`);
    }
  });
});
