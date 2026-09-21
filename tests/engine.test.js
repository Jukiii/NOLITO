import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCorrect,
  applyHit,
  applyMiss,
  createGameState,
  difficultyGain,
  speedGain,
  tick,
  typingSpeed,
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
      wordMissed: false,
      streak: 0,
      bestStreak: 0,
      byDifficulty: {},
      shockUntil: 0,
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

// 難易度・速さの加点(Phase 12 PR 3)
const bonusStage = {
  ...stage,
  difficulty_gain: 1,
  speed_gain: 3,
  speed_min_cps: 2,
  speed_max_cps: 6,
};

describe("打った速さ(typingSpeed)", () => {
  it("(打鍵数 - 1) ÷ 秒数。最初の打鍵から最後の打鍵までの間隔で測る", () => {
    assert.equal(typingSpeed(5, 2), 2);
    assert.equal(typingSpeed(11, 2), 5);
  });

  it("秒数が 0 以下・数でない、打鍵数が 2 未満なら 0(加点なしで、落ちない)", () => {
    for (const [keys, seconds] of [
      [5, 0],
      [5, -1],
      [5, NaN],
      [5, Infinity],
      [5, undefined],
      [5, null],
      [1, 2],
      [0, 2],
      [NaN, 2],
      [undefined, 2],
    ]) {
      assert.equal(typingSpeed(keys, seconds), 0, `${keys}, ${seconds}`);
    }
  });
});

describe("難易度の加点(difficultyGain)", () => {
  it("difficulty_gain × (難易度 - 1)。難易度 1 は 0、3 は 2 倍", () => {
    assert.equal(difficultyGain(bonusStage, 1), 0);
    assert.equal(difficultyGain(bonusStage, 2), 1);
    assert.equal(difficultyGain(bonusStage, 3), 2);
    assert.equal(difficultyGain({ ...bonusStage, difficulty_gain: 0.5 }, 3), 1);
  });

  it("難易度が増えるほど、増える距離が増える(段階的)", () => {
    const gains = [1, 2, 3].map((difficulty) => wordGain(bonusStage, 8, { difficulty }));
    assert.ok(gains[0] < gains[1] && gains[1] < gains[2]);
    assert.equal(gains[1] - gains[0], 1);
  });

  it("語録の範囲(1〜5)の外は、範囲に収める。不明な値・項目がない stage は 0", () => {
    assert.equal(difficultyGain(bonusStage, 0), 0);
    assert.equal(difficultyGain(bonusStage, -3), 0);
    assert.equal(difficultyGain(bonusStage, 100), 4);
    for (const value of [undefined, null, NaN, "3", Infinity]) {
      assert.equal(difficultyGain(bonusStage, value), 0, String(value));
    }
    assert.equal(difficultyGain(stage, 3), 0);
    assert.equal(difficultyGain({ ...stage, difficulty_gain: -1 }, 3), 0);
  });
});

describe("速さの加点(speedGain)", () => {
  it("min 以下は 0、max 以上は上限(speed_gain)、その間は比例", () => {
    // 5 打鍵 = 4 間隔。4 ÷ 秒 = 打鍵/秒
    assert.equal(speedGain(bonusStage, 5, 4), 0); // 1 打鍵/秒(min の 2 より遅い)
    assert.equal(speedGain(bonusStage, 5, 2), 0); // ちょうど min
    assert.equal(speedGain(bonusStage, 5, 1), 3 * ((4 - 2) / 4)); // 4 打鍵/秒 → 半分
    assert.equal(speedGain(bonusStage, 5, 4 / 6), 3); // ちょうど max
    assert.equal(speedGain(bonusStage, 5, 0.1), 3); // max より速くても、上限で頭打ち
  });

  it("速いほど増える(単調)。遅くても、減らない(加算だけ)", () => {
    const seconds = [8, 4, 2, 1.5, 1, 0.8, 0.5];
    const gains = seconds.map((value) => speedGain(bonusStage, 9, value));
    for (let i = 1; i < gains.length; i++) assert.ok(gains[i] >= gains[i - 1], String(i));
    assert.ok(gains.every((gain) => gain >= 0 && gain <= 3));
    assert.ok(gains.at(-1) > gains[0]);
  });

  it("時間が不正(0・負・NaN・なし)、項目がない stage、範囲が不正な stage は 0", () => {
    for (const seconds of [0, -1, NaN, undefined, null]) {
      assert.equal(speedGain(bonusStage, 9, seconds), 0, String(seconds));
    }
    assert.equal(speedGain(stage, 9, 0.5), 0);
    assert.equal(speedGain({ ...bonusStage, speed_gain: 0 }, 9, 0.5), 0);
    assert.equal(speedGain({ ...bonusStage, speed_min_cps: 6, speed_max_cps: 2 }, 9, 0.5), 0);
    assert.equal(speedGain({ ...bonusStage, speed_min_cps: 4, speed_max_cps: 4 }, 9, 0.5), 0);
  });
});

describe("1語の増分(wordGain)= 基本 + 文字数 + 難易度 + 速さ", () => {
  it("options がなければ、文字数の分まで(従来と同じ)", () => {
    assert.equal(wordGain(bonusStage, 10), 11);
    assert.equal(wordGain(stage, 10, { difficulty: 3, seconds: 0.1 }), 11);
  });

  it("4 つの合計になる", () => {
    // 基本 5 + 0.6 × 10 + 難易度 3 → 2 + 速さ(9 打鍵を 2 秒 = 4 打鍵/秒 → 半分の 1.5)
    const gain = wordGain(bonusStage, 10, { difficulty: 3, seconds: 2, keystrokes: 9 });
    assert.ok(Math.abs(gain - (5 + 6 + 2 + 1.5)) < 1e-9, String(gain));
  });

  it("速さは、実際に打った打鍵数で数える(打鍵数がなければ、文字数)", () => {
    const withKeys = wordGain(bonusStage, 10, { seconds: 2, keystrokes: 5 }); // 2 打鍵/秒 → 0
    const withoutKeys = wordGain(bonusStage, 10, { seconds: 2 }); // 文字数 10 → 4.5 打鍵/秒
    assert.equal(withKeys, 11);
    assert.ok(withoutKeys > withKeys);
  });

  it("applyCorrect に渡した options が、距離に反映される。最大値は超えない", () => {
    const plain = applyCorrect(createGameState(bonusStage), bonusStage, 10);
    const bonus = applyCorrect(createGameState(bonusStage), bonusStage, 10, {
      difficulty: 3,
      seconds: 1,
      keystrokes: 10,
    });
    assert.equal(plain.distance, 71);
    assert.ok(bonus.distance > plain.distance);
    const capped = applyCorrect({ ...createGameState(bonusStage), distance: 99 }, bonusStage, 10, {
      difficulty: 3,
      seconds: 1,
      keystrokes: 10,
    });
    assert.equal(capped.distance, 100);
  });

  it("ミス・時間の減り方は、加点の項目に影響されない(長さで減る新しいルールはない)", () => {
    assert.equal(applyMiss(createGameState(bonusStage), bonusStage).distance, 57);
    assert.equal(tick(createGameState(bonusStage), bonusStage, 2).distance, 57);
  });
});

// 連続ノーミス・難易度ごとの語数(Phase 13 PR 3)
describe("連続ノーミス(streak・bestStreak)", () => {
  const big = { ...stage, goal_words: 50 };
  const correct = (state, options) => applyCorrect(state, big, 5, options);

  it("ミスなしで打ち終えた語ごとに、連続が 1 ずつ増え、最高も更新される", () => {
    let state = createGameState(big);
    for (let i = 1; i <= 4; i++) {
      state = correct(state);
      assert.equal(state.streak, i);
      assert.equal(state.bestStreak, i);
    }
  });

  it("ミスした時点で、連続は 0 に戻る(最高は残る)", () => {
    let state = correct(correct(correct(createGameState(big))));
    state = applyMiss(state, big);
    assert.equal(state.streak, 0);
    assert.equal(state.bestStreak, 3);
  });

  it("ミスのあった語を打ち終えても、連続には数えない。次の語から、また数える", () => {
    let state = correct(correct(createGameState(big)));
    state = applyMiss(state, big);
    state = correct(state); // ミスのあった語
    assert.equal(state.streak, 0);
    assert.equal(state.correct, 3);
    state = correct(state);
    assert.equal(state.streak, 1);
    state = correct(state);
    assert.equal(state.streak, 2);
    assert.equal(state.bestStreak, 2);
  });

  it("1 つの語で何回ミスしても、連続が途切れるのは、その語だけ", () => {
    let state = createGameState(big);
    for (let i = 0; i < 3; i++) state = applyMiss(state, big);
    state = correct(state);
    assert.equal(state.streak, 0);
    state = correct(state);
    assert.equal(state.streak, 1);
  });

  it("最高は、途中の連続が途切れたあとの、短い連続では下がらない", () => {
    let state = createGameState(big);
    for (let i = 0; i < 5; i++) state = correct(state);
    state = applyMiss(state, big);
    state = correct(state);
    for (let i = 0; i < 2; i++) state = correct(state);
    assert.equal(state.bestStreak, 5);
    assert.equal(state.streak, 2);
  });

  it("ミスのないプレイは、打ち終えた語数が、そのまま最高になる(クリアまで)", () => {
    let state = createGameState(stage);
    for (let i = 0; i < stage.goal_words; i++) state = applyCorrect(state, stage, 5);
    assert.equal(state.status, "cleared");
    assert.equal(state.bestStreak, stage.goal_words);
  });

  it("つかまった(ゲームオーバー)プレイでも、それまでの最高が残る", () => {
    let state = createGameState(big);
    state = correct(correct(state));
    state = tick(state, big, 1000);
    assert.equal(state.status, "gameover");
    assert.equal(state.bestStreak, 2);
  });

  it("終了後は変わらない。元の状態を書き換えない", () => {
    const state = correct(createGameState(big));
    const before = JSON.stringify(state);
    correct(state);
    applyMiss(state, big);
    assert.equal(JSON.stringify(state), before);
    const over = { ...state, status: "gameover" };
    assert.equal(correct(over), over);
  });
});

describe("難易度ごとの語数(byDifficulty)", () => {
  const big = { ...stage, goal_words: 50 };

  it("打ち終えた語を、難易度ごとに数える(キーは文字列)", () => {
    let state = createGameState(big);
    for (const difficulty of [1, 2, 2, 3, 3, 3]) {
      state = applyCorrect(state, big, 5, { difficulty });
    }
    assert.deepEqual(state.byDifficulty, { 1: 1, 2: 2, 3: 3 });
    assert.equal(
      Object.values(state.byDifficulty).reduce((a, b) => a + b, 0),
      state.correct,
    );
  });

  it("難易度を渡さない・範囲外・整数でない値は、数えない(落ちない)", () => {
    let state = createGameState(big);
    for (const difficulty of [undefined, null, 0, 6, -1, 1.5, NaN, "2", Infinity]) {
      state = applyCorrect(state, big, 5, { difficulty });
    }
    state = applyCorrect(state, big, 5);
    assert.deepEqual(state.byDifficulty, {});
    assert.equal(state.correct, 10);
  });

  it("ミスした語も、打ち終えれば、数える(ミスは、別に数える)", () => {
    let state = applyMiss(createGameState(big), big);
    state = applyCorrect(state, big, 5, { difficulty: 2 });
    assert.deepEqual(state.byDifficulty, { 2: 1 });
  });

  it("元の状態を書き換えない", () => {
    const state = applyCorrect(createGameState(big), big, 5, { difficulty: 1 });
    const before = JSON.stringify(state);
    applyCorrect(state, big, 5, { difficulty: 1 });
    assert.equal(JSON.stringify(state), before);
  });
});
