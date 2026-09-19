import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createKeyStats,
  mergeKeyStats,
  mostMissedKeys,
  recordHit,
  recordMiss,
  topConfusions,
  totalHits,
  totalMisses,
  weakKeys,
} from "../public/assets/js/games/escape-boss/keystats.js";

describe("打鍵の記録", () => {
  it("正しい打鍵は、キーの hits に加わる", () => {
    let stats = createKeyStats();
    stats = recordHit(stats, "a");
    stats = recordHit(stats, "a");
    stats = recordHit(stats, "-");
    assert.deepEqual(stats.keys, { a: { hits: 2, misses: 0 }, "-": { hits: 1, misses: 0 } });
  });

  it("ミスは、期待したキーの misses・打ち間違いの組・語のミス数に加わる", () => {
    let stats = createKeyStats();
    stats = recordMiss(stats, "i", "o", "engineer-001");
    stats = recordMiss(stats, "i", "o", "engineer-001");
    stats = recordMiss(stats, "i", "u", "sales-002");
    assert.deepEqual(stats.keys, { i: { hits: 0, misses: 3 } });
    assert.deepEqual(stats.confusions, { "i>o": 2, "i>u": 1 });
    assert.deepEqual(stats.wordMisses, { "engineer-001": 2, "sales-002": 1 });
  });

  it("対象外の文字は記録しない(期待したキーが対象外なら何も変わらない)", () => {
    const stats = createKeyStats();
    assert.equal(recordHit(stats, "A"), stats);
    assert.equal(recordHit(stats, "ab"), stats);
    assert.equal(recordHit(stats, "!"), stats);
    assert.equal(recordMiss(stats, "!", "a", "x-001"), stats);
  });

  it("実際に打ったキーが対象外(記号など)でも、ミスは数え、打ち間違いの組だけ省く", () => {
    const stats = recordMiss(createKeyStats(), "a", "!", "x-001");
    assert.deepEqual(stats.keys, { a: { hits: 0, misses: 1 } });
    assert.deepEqual(stats.confusions, {});
    assert.deepEqual(stats.wordMisses, { "x-001": 1 });
  });

  it("元の集計を書き換えない", () => {
    const stats = createKeyStats();
    recordHit(stats, "a");
    recordMiss(stats, "a", "b", "w");
    assert.deepEqual(stats, createKeyStats());
  });

  it("打つべきキーの hits と misses は同じキーに集まる", () => {
    let stats = recordHit(createKeyStats(), "s");
    stats = recordMiss(stats, "s", "d", "w");
    assert.deepEqual(stats.keys.s, { hits: 1, misses: 1 });
    assert.equal(totalHits(stats), 1);
    assert.equal(totalMisses(stats), 1);
  });
});

describe("集計の足し合わせ", () => {
  it("複数のプレイの集計を合計する。欠けている項目は空として扱う", () => {
    const a = recordMiss(recordHit(createKeyStats(), "a"), "a", "s", "w1");
    const b = recordHit(recordHit(createKeyStats(), "a"), "b");
    const total = mergeKeyStats([a, b, undefined, {}]);
    assert.deepEqual(total.keys, { a: { hits: 2, misses: 1 }, b: { hits: 1, misses: 0 } });
    assert.deepEqual(total.confusions, { "a>s": 1 });
    assert.deepEqual(total.wordMisses, { w1: 1 });
  });

  it("空のリストは空の集計", () => {
    assert.deepEqual(mergeKeyStats([]), createKeyStats());
  });
});

describe("苦手なキー", () => {
  const stats = {
    keys: {
      a: { hits: 90, misses: 10 }, // 10%
      s: { hits: 8, misses: 4 }, // 33% (12回)
      d: { hits: 1, misses: 2 }, // 打鍵が少ない(3回)
      f: { hits: 20, misses: 0 }, // ミスなし
      g: { hits: 15, misses: 5 }, // 25% (20回)
      h: { hits: 6, misses: 4 }, // 40% (10回)
    },
    confusions: {},
    wordMisses: {},
  };

  it("ミス率の高い順。打鍵が少ないキーとミスのないキーは除く", () => {
    const keys = weakKeys(stats).map((item) => item.key);
    assert.deepEqual(keys, ["h", "s", "g", "a"]);
  });

  it("ミス率と打鍵数を返す", () => {
    const [top] = weakKeys(stats);
    assert.deepEqual(top, { key: "h", attempts: 10, misses: 4, rate: 0.4 });
  });

  it("最低打鍵数と件数を指定できる", () => {
    assert.deepEqual(
      weakKeys(stats, { minAttempts: 3, limit: 2 }).map((i) => i.key),
      ["d", "h"],
    );
    assert.deepEqual(weakKeys(stats, { minAttempts: 1000 }), []);
  });

  it("同じミス率なら、打鍵の多いキーが上位", () => {
    const tie = {
      keys: { x: { hits: 8, misses: 2 }, y: { hits: 16, misses: 4 } },
      confusions: {},
      wordMisses: {},
    };
    assert.deepEqual(
      weakKeys(tie).map((i) => i.key),
      ["y", "x"],
    );
  });

  it("記録がなければ空", () => {
    assert.deepEqual(weakKeys(createKeyStats()), []);
  });
});

describe("1回のプレイの分析", () => {
  it("ミスの多いキーを、回数の多い順に返す", () => {
    let stats = createKeyStats();
    for (const [expected, typed] of [
      ["s", "d"],
      ["s", "d"],
      ["h", "j"],
      ["i", "o"],
      ["s", "a"],
    ]) {
      stats = recordMiss(stats, expected, typed, "w");
    }
    stats = recordHit(stats, "s");
    assert.deepEqual(mostMissedKeys(stats), [
      { key: "s", misses: 3, attempts: 4 },
      { key: "h", misses: 1, attempts: 1 },
      { key: "i", misses: 1, attempts: 1 },
    ]);
    assert.equal(mostMissedKeys(stats, 1).length, 1);
  });

  it("よくある打ち間違いを、回数の多い順に返す", () => {
    let stats = createKeyStats();
    for (const [expected, typed] of [
      ["i", "o"],
      ["i", "o"],
      ["a", "s"],
    ]) {
      stats = recordMiss(stats, expected, typed, "w");
    }
    assert.deepEqual(topConfusions(stats), [
      { expected: "i", typed: "o", count: 2 },
      { expected: "a", typed: "s", count: 1 },
    ]);
  });

  it("ミスがなければ空", () => {
    const stats = recordHit(createKeyStats(), "a");
    assert.deepEqual(mostMissedKeys(stats), []);
    assert.deepEqual(topConfusions(stats), []);
  });
});
