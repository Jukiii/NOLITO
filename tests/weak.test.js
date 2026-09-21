// 苦手な語の出やすさ(Phase 13 PR 1)のテスト: 重みの計算と、重みつきの出題。
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { pickWords } from "../public/assets/js/games/escape-boss/vocabulary.js";
import {
  DEFAULT_WEAK_LEVEL,
  WEAK_LEVELS,
  isWeakLevel,
  weakWeights,
} from "../public/assets/js/games/escape-boss/weak.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const items = Array.from({ length: 30 }, (_, i) => ({
  id: `w-${String(i + 1).padStart(3, "0")}`,
  roles: ["senpai"],
  weak_detection: { enabled: true },
}));
const id = (n) => `w-${String(n).padStart(3, "0")}`;
// results は、新しい順
const play = (playedAt, wordMisses) => ({ playedAt, wordMisses });

// 決まった順序の疑似乱数(mulberry32)。連番の種でも、最初の値が偏らないもの
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("段階", () => {
  it("なし・ふつう・多め。既定は、ふつう", () => {
    assert.deepEqual(Object.keys(WEAK_LEVELS), ["off", "normal", "high"]);
    assert.equal(DEFAULT_WEAK_LEVEL, "normal");
    assert.ok(isWeakLevel("off") && isWeakLevel("normal") && isWeakLevel("high"));
    for (const bad of ["", "low", "__proto__", "toString", 1, null, undefined, {}]) {
      assert.ok(!isWeakLevel(bad), String(bad));
    }
  });

  it("重みは、最大でも、ふつう 2 倍・多め 3 倍(偏りすぎない)", () => {
    const max = (level) => 1 + WEAK_LEVELS[level].strength * WEAK_LEVELS[level].cap;
    assert.equal(max("normal"), 2);
    assert.equal(max("high"), 3);
    assert.equal(max("off"), 1);
  });
});

describe("語の重み(weakWeights)", () => {
  it("ミスした語だけが、1 より大きくなる。ミスの数が多いほど、大きい(上限まで)", () => {
    const weights = weakWeights(
      [play(1, { [id(1)]: 1, [id(2)]: 2, [id(3)]: 4, [id(4)]: 9 })],
      items,
    );
    assert.equal(weights.size, 4);
    assert.equal(weights.get(id(1)), 1.25);
    assert.equal(weights.get(id(2)), 1.5);
    assert.equal(weights.get(id(3)), 2);
    assert.equal(weights.get(id(4)), 2); // 上限(4 回分)で頭打ち
    assert.equal(weights.get(id(5)), undefined);
  });

  it("多めは、ふつうより、大きい", () => {
    const results = [play(1, { [id(1)]: 2 })];
    const normal = weakWeights(results, items, { level: "normal" }).get(id(1));
    const high = weakWeights(results, items, { level: "high" }).get(id(1));
    assert.ok(high > normal && normal > 1);
  });

  it("なし・知らない段階は、空(完全にランダム)", () => {
    const results = [play(1, { [id(1)]: 5 })];
    assert.equal(weakWeights(results, items, { level: "off" }).size, 0);
    for (const level of ["low", "__proto__", 3, null]) {
      assert.equal(weakWeights(results, items, { level }).size, 0, String(level));
    }
  });

  it("直近 20 プレイだけを見る。複数のプレイのミスは、合計する", () => {
    const results = Array.from({ length: 25 }, (_, i) =>
      play(1000 - i, i === 0 || i === 19 ? { [id(1)]: 1 } : i === 20 ? { [id(2)]: 9 } : {}),
    );
    const weights = weakWeights(results, items);
    assert.equal(weights.get(id(1)), 1.5); // 1 番目と 20 番目の合計 2 回
    assert.equal(weights.has(id(2)), false); // 21 番目は、対象外
  });

  it("語録にない語・ミスの数が不正な値・weakBoost の対象外の語は、無視する", () => {
    const off = items.map((item) =>
      item.id === id(3) ? { ...item, weak_detection: { enabled: false } } : item,
    );
    const weights = weakWeights(
      [
        play(1, {
          "gone-001": 5,
          [id(1)]: 0,
          [id(2)]: -1,
          [id(4)]: 1.5,
          [id(5)]: "x",
          [id(6)]: null,
          [id(3)]: 3,
          [id(7)]: 1,
        }),
      ],
      off,
    );
    assert.deepEqual([...weights.keys()], [id(7)]);
  });

  it("記録が空・壊れていても、落ちない。入力を書き換えない", () => {
    for (const results of [[], undefined, null, [null, undefined, {}, { wordMisses: null }]]) {
      assert.equal(weakWeights(results, items).size, 0);
    }
    assert.equal(weakWeights([play(1, { [id(1)]: 1 })], undefined).size, 0);
    const results = [play(2, { [id(1)]: 1 }), play(1, { [id(1)]: 2 })];
    const before = JSON.stringify(results) + JSON.stringify(items);
    weakWeights(results, items);
    assert.equal(JSON.stringify(results) + JSON.stringify(items), before);
  });
});

describe("重みつきの出題(pickWords)", () => {
  const weights = new Map([[id(1), 3]]);

  it("重みがなければ、従来と同じ結果(同じ乱数で、同じ語・同じ順)", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const ids = (options) =>
        pickWords(items, "senpai", 14, seeded(seed), options).map((word) => word.id);
      const plain = ids(undefined);
      assert.deepEqual(ids({}), plain);
      assert.deepEqual(ids({ weights: null }), plain);
      assert.deepEqual(ids({ weights: new Map() }), plain);
    }
  });

  it("重みがあっても、指定の語数を、重複なしで選ぶ", () => {
    const many = new Map(items.map((item, i) => [item.id, 1 + (i % 4)]));
    for (let seed = 1; seed <= 100; seed++) {
      const words = pickWords(items, "senpai", 15, seeded(seed), { weights: many });
      assert.equal(words.length, 15);
      assert.equal(new Set(words.map((word) => word.id)).size, 15);
    }
  });

  it("苦手な語(重み 3)は、そうでない語より、選ばれやすい。ただし、いつも選ばれるわけではない", () => {
    const trials = 3000;
    let weak = 0;
    let other = 0;
    for (let seed = 1; seed <= trials; seed++) {
      const ids = new Set(
        pickWords(items, "senpai", 15, seeded(seed), { weights }).map((w) => w.id),
      );
      if (ids.has(id(1))) weak += 1;
      if (ids.has(id(2))) other += 1;
    }
    const weakRate = weak / trials;
    const otherRate = other / trials;
    // 30 語から 15 語: 重みなしなら、どの語も約 50%
    assert.ok(otherRate > 0.42 && otherRate < 0.55, `ほかの語: ${otherRate}`);
    assert.ok(weakRate > otherRate + 0.15, `苦手な語: ${weakRate} / ほかの語: ${otherRate}`);
    assert.ok(weakRate < 0.95, `苦手な語が、ほぼ毎回出る: ${weakRate}`);
  });

  it("重みが大きいほど、先頭近くに来やすい(袋の順が、重みに従う)", () => {
    const heavy = new Map([[id(1), 4]]);
    let first = 0;
    let firstPlain = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      if (pickWords(items, "senpai", 5, seeded(seed), { weights: heavy })[0].id === id(1))
        first += 1;
      if (pickWords(items, "senpai", 5, seeded(seed))[0].id === id(1)) firstPlain += 1;
    }
    assert.ok(first > firstPlain * 2, `${first} vs ${firstPlain}`);
  });

  it("重みが不正(0・負・NaN・文字)でも、1 として扱う。落ちない", () => {
    const bad = new Map([
      [id(1), 0],
      [id(2), -3],
      [id(3), NaN],
      [id(4), "x"],
      [id(5), Infinity],
    ]);
    const words = pickWords(items, "senpai", 10, seeded(7), { weights: bad });
    assert.equal(new Set(words.map((word) => word.id)).size, 10);
  });

  it("語が足りないときの再利用でも、直前と同じ語は続けない", () => {
    const few = items.slice(0, 3);
    for (let seed = 1; seed <= 50; seed++) {
      const words = pickWords(few, "senpai", 9, seeded(seed), {
        weights: new Map([[id(1), 4]]),
      });
      assert.equal(words.length, 9);
      for (let i = 1; i < words.length; i++) assert.notEqual(words[i].id, words[i - 1].id);
    }
  });

  it("役職の対象でない語は、重みがあっても、選ばない", () => {
    const mixed = [...items, { id: "boss-only", roles: ["kaicho"] }];
    for (let seed = 1; seed <= 30; seed++) {
      const words = pickWords(mixed, "senpai", 15, seeded(seed), {
        weights: new Map([["boss-only", 4]]),
      });
      assert.ok(words.every((word) => word.id !== "boss-only"));
    }
  });

  it("入力(語・重み)を書き換えない", () => {
    const map = new Map([[id(1), 3]]);
    const before = JSON.stringify(items) + JSON.stringify([...map]);
    pickWords(items, "senpai", 10, seeded(3), { weights: map });
    assert.equal(JSON.stringify(items) + JSON.stringify([...map]), before);
  });
});

describe("実際の語録", () => {
  const vocabularies = readdirSync(`${root}public/data/vocabulary/`).map((file) =>
    JSON.parse(readFileSync(`${root}public/data/vocabulary/${file}`, "utf8")),
  );

  it("全職種で、重みつきでも、目標語数(最大 16)を、重複なしで選べる", () => {
    for (const vocabulary of vocabularies) {
      const weights = new Map(vocabulary.items.slice(0, 8).map((item) => [item.id, 3]));
      for (let seed = 1; seed <= 20; seed++) {
        const words = pickWords(vocabulary.items, "kaicho", 16, seeded(seed), { weights });
        assert.equal(new Set(words.map((word) => word.id)).size, 16, vocabulary.job_id);
      }
    }
  });
});
