import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickWords, shuffle } from "../public/assets/js/games/escape-boss/vocabulary.js";

const items = Array.from({ length: 10 }, (_, i) => ({ id: `w-${i}`, roles: ["senpai"] }));

// 決まった順序の疑似乱数(テストを再現可能にする)
function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

describe("出題", () => {
  it("シャッフルは要素を失わず、元の配列を変えない", () => {
    const original = [1, 2, 3, 4, 5];
    const result = shuffle(original, seeded(1));
    assert.deepEqual([...result].sort(), [1, 2, 3, 4, 5]);
    assert.deepEqual(original, [1, 2, 3, 4, 5]);
  });

  it("指定した語数を、重複なしで選ぶ", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const words = pickWords(items, "senpai", 8, seeded(seed));
      assert.equal(words.length, 8);
      assert.equal(new Set(words.map((w) => w.id)).size, 8);
    }
  });

  it("役職の対象でない語は選ばない", () => {
    const mixed = [...items, { id: "boss-only", roles: ["kaicho"] }];
    for (let seed = 1; seed <= 30; seed++) {
      const words = pickWords(mixed, "senpai", 10, seeded(seed));
      assert.ok(words.every((w) => w.id !== "boss-only"));
    }
  });

  it("語が足りないときだけ再利用する(直前と同じ語は続けない)", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const words = pickWords(items.slice(0, 3), "senpai", 9, seeded(seed));
      assert.equal(words.length, 9);
      for (let i = 1; i < words.length; i++) assert.notEqual(words[i].id, words[i - 1].id);
    }
  });

  it("対象語がなければエラー", () => {
    assert.throws(() => pickWords(items, "kaicho", 3));
  });

  it("毎回同じ順序にならない", () => {
    const orders = new Set();
    for (let seed = 1; seed <= 20; seed++) {
      orders.add(
        pickWords(items, "senpai", 8, seeded(seed))
          .map((w) => w.id)
          .join(","),
      );
    }
    assert.ok(orders.size > 1);
  });
});
