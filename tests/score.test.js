import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accuracyOf, speedOf, summarize } from "../public/assets/js/games/escape-boss/score.js";

const state = (overrides) => ({
  status: "cleared",
  distance: 60,
  correct: 8,
  miss: 2,
  hits: 60,
  elapsed: 30,
  ...overrides,
});

describe("スコア", () => {
  it("正確率は 正しい打鍵 ÷ (正しい打鍵 + ミス)。打っていなければ 0", () => {
    assert.equal(accuracyOf(90, 10), 0.9);
    assert.equal(accuracyOf(0, 0), 0);
    assert.equal(accuracyOf(0, 5), 0);
  });

  it("打鍵速度は 打鍵数 ÷ 経過秒。経過 0 秒なら 0", () => {
    assert.equal(speedOf(60, 30), 2);
    assert.equal(speedOf(10, 0), 0);
  });

  it("クリアのスコア(倍率 1.0)", () => {
    // 8*100 + 300 + 60*5 + (60/62*100)*3 + 2*50
    const { score, accuracy, cps } = summarize(state(), 1);
    assert.equal(cps, 2);
    assert.ok(Math.abs(accuracy - 60 / 62) < 1e-9);
    assert.equal(score, Math.round(800 + 300 + 300 + (60 / 62) * 300 + 100));
  });

  it("倍率がそのまま掛かる", () => {
    const one = summarize(state(), 1).score;
    const triple = summarize(state(), 3).score;
    assert.ok(Math.abs(triple - one * 3) <= 2);
  });

  it("ゲームオーバーにはクリアボーナスがなく、距離は 0", () => {
    const cleared = summarize(state(), 1).score;
    const over = summarize(state({ status: "gameover", distance: 0, correct: 3 }), 1).score;
    assert.ok(over < cleared);
    // 3*100 + 0 + 0 + 正確率 + 速度
    assert.equal(over, Math.round(300 + (60 / 62) * 300 + 100));
  });

  it("正解が多いほど、距離が残るほど高い", () => {
    const base = summarize(state(), 1).score;
    assert.ok(summarize(state({ correct: 9 }), 1).score > base);
    assert.ok(summarize(state({ distance: 80 }), 1).score > base);
    assert.ok(summarize(state({ miss: 10 }), 1).score < base);
  });

  it("スコアは整数", () => {
    assert.ok(Number.isInteger(summarize(state({ hits: 61, miss: 3 }), 1.2).score));
  });

  it("何も打たなかった場合も計算できる", () => {
    const result = summarize(
      state({ hits: 0, miss: 0, elapsed: 0, correct: 0, status: "gameover", distance: 0 }),
      1,
    );
    assert.equal(result.score, 0);
  });
});
