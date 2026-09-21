// 入力方式(ローマ字の書き方。Phase 13 PR 2)のテスト: 方式の定義と、実際の語録の全語での確認。
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_INPUT_STYLE,
  INPUT_STYLES,
  isInputStyle,
  matcherOptionsFor,
} from "../public/assets/js/games/escape-boss/input-style.js";
import { createMatcher } from "../public/assets/js/games/escape-boss/romaji.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const words = readdirSync(`${root}public/data/vocabulary/`).flatMap(
  (file) => JSON.parse(readFileSync(`${root}public/data/vocabulary/${file}`, "utf8")).items,
);

// 文字列を 1 文字ずつ入力する。途中で miss があれば "miss"
function typeAll(reading, text, options) {
  const matcher = createMatcher(reading, options);
  let result = "ok";
  for (const char of text) {
    result = matcher.input(char);
    if (result === "miss") return "miss";
  }
  return matcher.done ? "done" : result;
}

describe("方式の定義", () => {
  it("標準・訓令式で表示・表示どおりだけ。既定は、標準", () => {
    assert.deepEqual(Object.keys(INPUT_STYLES), ["standard", "kunrei", "strict"]);
    assert.equal(DEFAULT_INPUT_STYLE, "standard");
    assert.deepEqual(INPUT_STYLES.standard.options, { style: "hepburn", strict: false });
    assert.deepEqual(INPUT_STYLES.kunrei.options, { style: "kunrei", strict: false });
    assert.deepEqual(INPUT_STYLES.strict.options, { style: "hepburn", strict: true });
  });

  it("知っている名前だけが方式。知らない名前は、標準のオプションになる", () => {
    for (const name of Object.keys(INPUT_STYLES)) assert.ok(isInputStyle(name), name);
    for (const bad of [
      "",
      "STANDARD",
      "hepburn",
      "__proto__",
      "toString",
      1,
      null,
      undefined,
      {},
    ]) {
      assert.ok(!isInputStyle(bad), String(bad));
      assert.deepEqual(matcherOptionsFor(bad), INPUT_STYLES.standard.options, String(bad));
    }
  });

  it("定義は、書き換えられない", () => {
    assert.ok(Object.isFrozen(INPUT_STYLES) && Object.isFrozen(INPUT_STYLES.kunrei.options));
  });
});

describe("実際の語録(全語)", () => {
  it("語録は、180 語ある", () => {
    assert.ok(words.length >= 180);
  });

  for (const [name, { options }] of Object.entries(INPUT_STYLES)) {
    it(`${name}: 画面に表示される書き方で、全語を最後まで打てる`, () => {
      for (const word of words) {
        const shown = createMatcher(word.reading, options).remaining;
        assert.equal(typeAll(word.reading, shown, options), "done", `${word.id}: ${shown}`);
      }
    });
  }

  it("標準・訓令式: 語録に宣言された書き方(romaji)の全候補も、入力できる", () => {
    for (const style of ["standard", "kunrei"]) {
      for (const word of words) {
        for (const candidate of word.romaji) {
          const options = INPUT_STYLES[style].options;
          assert.equal(
            typeAll(word.reading, candidate, options),
            "done",
            `${style} ${word.id}: ${candidate}`,
          );
        }
      }
    }
  });

  it("標準: 表示は、これまでと同じ(語録の先頭の候補と一致)", () => {
    for (const word of words) {
      assert.equal(createMatcher(word.reading).remaining, word.romaji[0], word.id);
      assert.equal(
        createMatcher(word.reading, INPUT_STYLES.standard.options).remaining,
        word.romaji[0],
        word.id,
      );
    }
  });

  it("訓令式: 表示に、ヘボン式の綴り(sh・ch・ts・j・fu)が出ない", () => {
    for (const word of words) {
      const shown = createMatcher(word.reading, INPUT_STYLES.kunrei.options).remaining;
      assert.ok(!/sh|ch|ts|j|fu/.test(shown), `${word.id}: ${shown}`);
    }
  });

  it("訓令式: ヘボン式の表示のほうを、そのまま打っても、入力できる(表示が違うだけ)", () => {
    for (const word of words) {
      const hepburn = createMatcher(word.reading).remaining;
      assert.equal(typeAll(word.reading, hepburn, INPUT_STYLES.kunrei.options), "done", word.id);
    }
  });

  it("訓令式で、表示の長さが変わる語は、37 語前後(じゅ = zyu のように、長くなる語もある)。全体では、約 2% 短い", () => {
    let hepburnTotal = 0;
    let kunreiTotal = 0;
    let differing = 0;
    for (const word of words) {
      const a = createMatcher(word.reading).canonicalLength;
      const b = createMatcher(word.reading, INPUT_STYLES.kunrei.options).canonicalLength;
      hepburnTotal += a;
      kunreiTotal += b;
      if (a !== b) differing += 1;
    }
    assert.ok(differing > 20 && differing < 60, String(differing));
    assert.ok(kunreiTotal < hepburnTotal && kunreiTotal > hepburnTotal * 0.95);
  });

  it("表示どおりだけ: 表示と違う書き方は、通らない(表示以外の、宣言された候補は、miss か未完了)", () => {
    let checked = 0;
    for (const word of words) {
      const shown = createMatcher(word.reading, INPUT_STYLES.strict.options).remaining;
      for (const candidate of word.romaji) {
        if (candidate === shown) continue;
        checked += 1;
        assert.notEqual(
          typeAll(word.reading, candidate, INPUT_STYLES.strict.options),
          "done",
          `${word.id}: ${candidate}`,
        );
      }
    }
    assert.ok(checked > 30, String(checked));
  });

  it("全方式で、標準の長さ(距離の文字数の分に使う)は、書き方の設定に関係なく、同じ", () => {
    for (const word of words) {
      const standard = createMatcher(word.reading).canonicalLength;
      assert.equal(standard, word.romaji[0].length, word.id);
    }
  });
});
