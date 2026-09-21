// 特殊ルールが、エンジン(engine.js)に働くことのテスト(Phase 17 PR 1)。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCorrect,
  applyMiss,
  createGameState,
  tick,
} from "../public/assets/js/games/escape-boss/engine.js";

const base = {
  max_distance: 100,
  initial_distance: 60,
  drain_per_second: 1,
  base_gain: 4,
  gain_per_char: 0.5,
  miss_penalty: 3,
  goal_words: 10,
};
const near = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ""} ${actual} ≠ ${expected}`);

const SURGE = { type: "surge", every: 10, duration: 2, warn: 1, multiplier: 2 };
const SHOCK = { type: "shock", duration: 2, multiplier: 2 };
const CLOSING = { type: "closing", from: 0.5, max: 1.5 };

describe("ルールなしは、従来どおり", () => {
  it("rules がない・空・無効だけの stage は、距離 = 減る速さ × 秒(1 回の tick で、そのまま)", () => {
    for (const stage of [
      base,
      { ...base, rules: [] },
      { ...base, rules: [{ type: "boom" }, null] },
    ]) {
      const state = tick(createGameState(stage), stage, 7.5);
      assert.equal(state.distance, 60 - 7.5);
      assert.equal(state.elapsed, 7.5);
    }
  });

  it("初期状態に、shockUntil = 0", () => {
    assert.equal(createGameState({ ...base, rules: [SHOCK] }).shockUntil, 0);
  });

  it("ミスで加速のルールがなければ、ミスをしても shockUntil は変わらない", () => {
    const stage = { ...base, rules: [SURGE, CLOSING] };
    const state = applyMiss({ ...createGameState(stage), elapsed: 5 }, stage);
    assert.equal(state.shockUntil, 0);
    assert.equal(state.distance, 57);
  });
});

describe("ダッシュ(surge)", () => {
  // every 10・duration 2・warn 1 → 8〜10 秒がダッシュ(2 倍)
  const stage = { ...base, rules: [SURGE] };

  it("ダッシュの間だけ、2 倍の速さで縮む(0〜10 秒: 8 + 2 × 2 = 12)", () => {
    const state = tick(createGameState(stage), stage, 10);
    near(state.distance, 60 - 12);
  });

  it("予告の間(7〜8 秒)は、加速しない", () => {
    const state = tick({ ...createGameState(stage), elapsed: 7 }, stage, 1);
    near(state.distance, 59);
  });

  it("周期は、くり返す(10〜20 秒でも、同じ)", () => {
    const state = tick({ ...createGameState(stage), elapsed: 10 }, stage, 10);
    near(state.distance, 60 - 12);
  });

  it("画面の刻み(0.1 秒ずつ)と、1 回の長い tick で、結果が同じ(0.05 秒の刻み)", () => {
    let stepped = createGameState(stage);
    for (let i = 0; i < 200; i++) stepped = tick(stepped, stage, 0.1);
    const whole = tick(createGameState(stage), stage, 20);
    near(stepped.distance, whole.distance);
    near(stepped.elapsed, 20);
  });
});

describe("ミスで加速(shock)", () => {
  const stage = { ...base, rules: [SHOCK] };

  it("ミスした瞬間から 2 秒間、2 倍の速さで縮む。その前・あとは、ふつう", () => {
    let state = { ...createGameState(stage), elapsed: 10 };
    state = applyMiss(state, stage);
    assert.equal(state.shockUntil, 12);
    near(state.distance, 57);
    state = tick(state, stage, 5); // 加速 2 秒(2 × 2)+ ふつう 3 秒
    near(state.distance, 57 - 7);
    assert.equal(state.shockUntil, 12, "終わったあとも、記録は残るが、働かない");
    near(tick(state, stage, 1).distance, 57 - 8);
  });

  it("加速の途中で、もう一度ミスすると、そこからまた 2 秒(延びる。短くはならない)", () => {
    let state = applyMiss({ ...createGameState(stage), elapsed: 10 }, stage);
    state = tick(state, stage, 1);
    state = applyMiss(state, stage);
    assert.equal(state.shockUntil, 13);
    const earlier = applyMiss({ ...createGameState(stage), elapsed: 10, shockUntil: 20 }, stage);
    assert.equal(earlier.shockUntil, 20, "短くはならない");
  });

  it("加速は、ミスをしていなければ、起きない", () => {
    near(tick(createGameState(stage), stage, 10).distance, 50);
  });
});

describe("追い詰め(closing)", () => {
  // 距離が 50% を切ると、少なくなるほど速くなる。0 で 1.5 倍
  const stage = { ...base, rules: [CLOSING], initial_distance: 100 };

  it("距離が半分以上の間は、ふつう。半分を切ると、速くなる", () => {
    near(tick(createGameState(stage), stage, 10).distance, 90);
    const low = { ...createGameState(stage), distance: 25 };
    const after = tick(low, stage, 0.05);
    // 距離 25(割合 0.25)→ 倍率 1.25。0.05 秒で、約 0.0625 縮む
    near(low.distance - after.distance, 0.05 * 1.25, "追い詰め");
  });

  it("距離 0 に近づくほど速い(1 秒で縮む量が、距離 40 より 距離 5 のほうが、大きい)", () => {
    const drop = (distance) =>
      distance - tick({ ...createGameState(stage), distance }, stage, 0.5).distance;
    assert.ok(drop(5) > drop(20) && drop(20) > drop(40) && drop(40) >= drop(80) - 1e-9);
  });

  it("距離が 0 になった時点で、ゲームオーバー(長い tick でも、途中で止まる)", () => {
    const state = tick({ ...createGameState(stage), distance: 10 }, stage, 60);
    assert.equal(state.status, "gameover");
    assert.equal(state.distance, 0);
  });
});

describe("重なり・上限・不正な入力", () => {
  it("3 つとも重なっても、倍率は 3 倍まで(減る速さ 1 なら、1 秒で 3 まで)", () => {
    const strong = {
      ...base,
      rules: [
        { ...SURGE, multiplier: 3 },
        { ...SHOCK, multiplier: 3 },
        { ...CLOSING, max: 2.5 },
      ],
    };
    let state = { ...createGameState(strong), elapsed: 8, distance: 1000 };
    state = { ...state, shockUntil: 12 };
    const after = tick({ ...state, distance: 5 }, { ...strong, max_distance: 1000 }, 1);
    assert.ok(5 - after.distance <= 3 + 1e-9, `${5 - after.distance}`);
    assert.ok(5 - after.distance > 2.9);
  });

  it("不正な秒数(負・NaN・無限)は、何もしない(状態は、そのまま)", () => {
    const stage = { ...base, rules: [SURGE] };
    const state = createGameState(stage);
    for (const seconds of [-1, Number.NaN, Infinity, -Infinity, "3", undefined]) {
      assert.equal(tick(state, stage, seconds), state, String(seconds));
    }
    assert.equal(tick(state, stage, 0).distance, 60);
  });

  it("入力の状態を書き換えない。終わったゲームは、そのまま", () => {
    const stage = { ...base, rules: [SURGE, SHOCK, CLOSING] };
    const state = createGameState(stage);
    const frozen = Object.freeze({ ...state });
    assert.doesNotThrow(() => tick(frozen, stage, 3));
    assert.doesNotThrow(() => applyMiss(frozen, stage));
    const over = { ...state, status: "gameover" };
    assert.equal(tick(over, stage, 3), over);
  });

  it("クリア判定は、これまでどおり(最後の 1 語で、距離が 0 以下でも、逃げ切り)", () => {
    const stage = { ...base, goal_words: 1, rules: [CLOSING] };
    const state = applyCorrect({ ...createGameState(stage), distance: -5 }, stage, 4);
    assert.equal(state.status, "cleared");
  });

  it("ルールの数値を変えると、結果が変わる(データで修正できる)", () => {
    const at = (multiplier) =>
      tick(
        createGameState({ ...base, rules: [{ ...SURGE, multiplier }] }),
        { ...base, rules: [{ ...SURGE, multiplier }] },
        10,
      ).distance;
    assert.ok(at(1.5) > at(2) && at(2) > at(3));
  });
});
