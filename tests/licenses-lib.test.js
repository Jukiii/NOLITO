// ライセンスキーの部品のテスト(Phase 9 PR 2): 生成・正規化・ハッシュ。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateKey,
  hashKey,
  keyHint,
  newLicense,
  normalizeKey,
} from "../functions/_lib/licenses.js";

const FORMAT =
  /^NLTO-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/;

describe("キーの生成", () => {
  it("NLTO-XXXXX-XXXXX-XXXXX-XXXXX の形で、紛らわしい文字(I・L・O・U)を含まない", () => {
    for (let i = 0; i < 200; i += 1) {
      const key = generateKey();
      assert.match(key, FORMAT);
      assert.ok(!/[ILOU]/.test(key.slice(5)), key);
    }
  });

  it("毎回違う(衝突しない)", () => {
    const keys = new Set(Array.from({ length: 2000 }, generateKey));
    assert.equal(keys.size, 2000);
  });

  it("32 種類の文字が、ほぼ均等に出る(偏りがない)", () => {
    const counts = new Map();
    for (let i = 0; i < 1000; i += 1) {
      for (const char of generateKey().slice(5).replaceAll("-", "")) {
        counts.set(char, (counts.get(char) ?? 0) + 1);
      }
    }
    assert.equal(counts.size, 32);
    // 20000 文字 / 32 = 625。極端に偏っていないこと(±30%)
    for (const [char, count] of counts) assert.ok(count > 440 && count < 810, `${char}: ${count}`);
  });
});

describe("キーの正規化", () => {
  const key = "NLTO-ABCDE-FGHJK-MNPQR-STVWX";
  const canonical = "NLTOABCDEFGHJKMNPQRSTVWX";

  it("正規の形(ハイフンなし・大文字)にする", () => {
    assert.equal(normalizeKey(key), canonical);
  });

  it("小文字・空白・ハイフンの有無・前後の空白を許す", () => {
    for (const input of [
      key.toLowerCase(),
      "NLTOABCDEFGHJKMNPQRSTVWX",
      "  nlto abcde fghjk mnpqr stvwx  ",
    ]) {
      assert.equal(normalizeKey(input), canonical, input);
    }
  });

  it("読み間違えやすい文字を直す(O→0、I・L→1)", () => {
    assert.equal(normalizeKey("NLTO-0O1IL-00000-00000-00000"), "NLTO00111000000000000000");
  });

  it("形が違うものは null(接頭辞・長さ・使えない文字・型)", () => {
    for (const bad of [
      "",
      "ABCDE-FGHJK-MNPQR-STVWX",
      "XXXX-ABCDE-FGHJK-MNPQR-STVWX",
      "NLTO-ABCDE-FGHJK-MNPQR-STVW",
      "NLTO-ABCDE-FGHJK-MNPQR-STVWXY",
      "NLTO-ABCDE-FGHJK-MNPQR-STVWU", // U は使わない
      "NLTO-ABCDE-FGHJK-MNPQR-STVW!",
      "NLTO-ABCDE-FGHJK-MNPQR-STVWX-EXTRA",
      "x".repeat(65),
      undefined,
      null,
      123,
      {},
      ["NLTO-ABCDE-FGHJK-MNPQR-STVWX"],
    ]) {
      assert.equal(normalizeKey(bad), null, String(bad));
    }
  });

  it("生成したキーは、そのまま正規化できる", () => {
    for (let i = 0; i < 100; i += 1) {
      const generated = generateKey();
      assert.equal(normalizeKey(generated), generated.replaceAll("-", ""));
    }
  });
});

describe("ハッシュ", () => {
  it("同じキーは同じ値、違うキーは違う値(43 文字の base64url)", async () => {
    const a = await hashKey("NLTOABCDEFGHJKMNPQRSTVWX");
    assert.equal(a, await hashKey("NLTOABCDEFGHJKMNPQRSTVWX"));
    assert.notEqual(a, await hashKey("NLTOABCDEFGHJKMNPQRSTVWY"));
    assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  });

  it("キーそのもの・その一部は、ハッシュに含まれない。ヒントは末尾 4 文字", async () => {
    const { key, row } = await newLicense({ productId: "kii-michi", now: 1 });
    const canonical = normalizeKey(key);
    assert.equal(row.keyHint, keyHint(canonical));
    assert.equal(row.keyHint, canonical.slice(-4));
    assert.ok(!JSON.stringify(row).includes(canonical));
    assert.ok(!JSON.stringify(row).includes(key));
  });
});
