// 語録の「意味が近い語」を見つける、決まった計算(Phase 25 PR2)のテスト。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadVocabularies } from "../scripts/lib/vocab-io.mjs";
import {
  DEFAULT_THRESHOLD,
  bigramSet,
  diceCoefficient,
  similarPairs,
} from "../scripts/lib/vocab-similarity.mjs";

const word = (id, japanese, explanation) => ({ id, japanese, explanation });

describe("bigramSet(2-gram の集合)", () => {
  it("隣り合う2文字の集合を作る。1文字以下は、空集合", () => {
    assert.deepEqual(bigramSet("あいう"), new Set(["あい", "いう"]));
    assert.deepEqual(bigramSet("あ"), new Set());
    assert.deepEqual(bigramSet(""), new Set());
  });
});

describe("diceCoefficient(Dice係数)", () => {
  it("完全に同じ集合は 1。まったく重ならなければ 0", () => {
    assert.equal(diceCoefficient(new Set(["あい", "いう"]), new Set(["あい", "いう"])), 1);
    assert.equal(diceCoefficient(new Set(["あい"]), new Set(["かき"])), 0);
  });

  it("どちらかが空集合なら 0(0 で割らない)", () => {
    assert.equal(diceCoefficient(new Set(), new Set(["あい"])), 0);
    assert.equal(diceCoefficient(new Set(), new Set()), 0);
  });

  it("一部が重なれば、0〜1の間", () => {
    const score = diceCoefficient(bigramSet("あいうえお"), bigramSet("あいうかき"));
    assert.ok(score > 0 && score < 1, String(score));
  });
});

describe("similarPairs(似た説明の組)", () => {
  it("しきい値(既定0.6)以上の組だけを、score の高い順で返す", () => {
    const items = [
      word("a", "語A", "材料を、下ごしらえして準備しておくこと。"),
      word("b", "語B", "材料を、下ごしらえして用意しておくこと。"),
      word("c", "語C", "まったく関係のない、別のことがら。"),
    ];
    const pairs = similarPairs(items);
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].aId, "a");
    assert.equal(pairs[0].bId, "b");
    assert.ok(pairs[0].score >= DEFAULT_THRESHOLD);
  });

  it("しきい値を指定できる", () => {
    const items = [word("a", "語A", "あいうえお。"), word("b", "語B", "あいうかき。")];
    const strict = similarPairs(items, { threshold: 0.99 });
    assert.deepEqual(strict, []);
    const loose = similarPairs(items, { threshold: 0.1 });
    assert.equal(loose.length, 1);
  });

  it("同じ id 同士は比べない。explanation が空・文字列でない語は、対象外(落ちない)", () => {
    const items = [
      word("a", "語A", "同じ説明。"),
      word("a", "語A", "同じ説明。"),
      word("b", "語B", ""),
      word("c", "語C", undefined),
    ];
    assert.deepEqual(similarPairs(items, { threshold: 0.1 }), []);
  });

  it("1組を、1回だけ返す(a-b と b-a を、両方は返さない)", () => {
    const items = [word("a", "語A", "同じ説明です。"), word("b", "語B", "同じ説明です。")];
    const pairs = similarPairs(items, { threshold: 0.5 });
    assert.equal(pairs.length, 1);
  });

  it("完全一致(score 1)も、返す(id・日本語の完全一致とは、別の観点なので対象外にしない)", () => {
    const items = [word("a", "語A", "同じ説明です。"), word("b", "語B", "同じ説明です。")];
    const [pair] = similarPairs(items);
    assert.equal(pair.score, 1);
  });

  it("実際の語録: しきい値0.6で、2組(職種をまたいだ組も検出できる)", () => {
    const items = loadVocabularies().flatMap((data) => data.items);
    const pairs = similarPairs(items);
    assert.deepEqual(
      pairs.map(({ aId, bId }) => `${aId}/${bId}`),
      ["food-service-007/food-service-012", "sales-001/sales-003"],
    );
    for (const pair of pairs) assert.ok(pair.score >= DEFAULT_THRESHOLD, JSON.stringify(pair));
  });
});
