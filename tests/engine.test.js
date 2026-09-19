import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCorrect,
  applyHit,
  applyMiss,
  createGameState,
  tick,
  wordGain,
} from "../public/assets/js/games/escape-boss/engine.js";

const stage = {
  max_distance: 100,
  initial_distance: 60,
  drain_per_second: 1.5,
  base_gain: 5,
  gain_per_char: 0.6,
  miss_penalty: 3,
  goal_words: 3,
};

describe("ゲームロジック", () => {
  it("初期状態", () => {
    assert.deepEqual(createGameState(stage), {
      status: "playing",
      distance: 60,
      correct: 0,
      miss: 0,
      hits: 0,
      elapsed: 0,
    });
  });

  it("正しい打鍵を数える(距離は変わらない)", () => {
    const state = applyHit(applyHit(createGameState(stage)));
    assert.equal(state.hits, 2);
    assert.equal(state.distance, 60);
    const over = { ...createGameState(stage), status: "gameover" };
    assert.equal(applyHit(over), over);
  });

  it("時間経過で距離が減り、経過時間が増える", () => {
    const state = tick(createGameState(stage), stage, 2);
    assert.equal(state.distance, 57);
    assert.equal(state.elapsed, 2);
    assert.equal(state.status, "playing");
  });

  it("距離が 0 になるとゲームオーバー(0 で止まる)", () => {
    const state = tick(createGameState(stage), stage, 100);
    assert.equal(state.status, "gameover");
    assert.equal(state.distance, 0);
  });

  it("正解で距離が増える(文字数が多いほど多い)", () => {
    assert.equal(wordGain(stage, 10), 11);
    const state = applyCorrect(createGameState(stage), stage, 10);
    assert.equal(state.distance, 71);
    assert.equal(state.correct, 1);
  });

  it("距離は最大値を超えない", () => {
    const state = applyCorrect({ ...createGameState(stage), distance: 99 }, stage, 10);
    assert.equal(state.distance, 100);
  });

  it("ミスで距離が減り、ミス数が増える", () => {
    const state = applyMiss(createGameState(stage), stage);
    assert.equal(state.distance, 57);
    assert.equal(state.miss, 1);
  });

  it("ミスで距離が 0 になるとゲームオーバー", () => {
    const state = applyMiss({ ...createGameState(stage), distance: 2 }, stage);
    assert.equal(state.status, "gameover");
    assert.equal(state.distance, 0);
  });

  it("目標語数の正解でクリア", () => {
    let state = createGameState(stage);
    state = applyCorrect(state, stage, 5);
    state = applyCorrect(state, stage, 5);
    assert.equal(state.status, "playing");
    state = applyCorrect(state, stage, 5);
    assert.equal(state.status, "cleared");
    assert.equal(state.correct, 3);
  });

  it("終了後は状態が変わらない", () => {
    const cleared = { ...createGameState(stage), status: "cleared" };
    assert.equal(tick(cleared, stage, 10), cleared);
    assert.equal(applyMiss(cleared, stage), cleared);
    assert.equal(applyCorrect(cleared, stage, 5), cleared);
    const over = { ...createGameState(stage), status: "gameover", distance: 0 };
    assert.equal(applyCorrect(over, stage, 5), over);
  });

  it("状態は不変(元のオブジェクトを書き換えない)", () => {
    const state = createGameState(stage);
    tick(state, stage, 5);
    applyMiss(state, stage);
    assert.equal(state.distance, 60);
    assert.equal(state.miss, 0);
  });
});
