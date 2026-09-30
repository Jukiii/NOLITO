// キャッシュ制御(Phase 28 PR1)のテスト。public/_headers の形と、長く持たせる範囲を検査する。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const rules = parse(text);

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
