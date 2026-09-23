// 難易度(Phase 18 PR 2)のテスト: difficulty.js(DOM・保存に触れない)。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_IDS,
  PRACTICE_DIFFICULTY,
  applyDifficulty,
  isDifficulty,
  isDifficultyUnlocked,
  normalizeDifficulties,
  normalizeDifficulty,
} from "../public/assets/js/games/escape-boss/difficulty.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

const VALID = Object.freeze({
  id: "hard",
  name: "むずかしい",
  description: "追ってくる人が速い。",
  rankable: true,
  unlock: "role_clear_normal",
  exp_multiplier: 1.6,
  modifiers: { drain: 1.3, gain: 0.82, initial: 0.85 },
});

describe("難易度の ID", () => {
  it("3 つ(easy・normal・hard)。既定は normal、練習は easy", () => {
    assert.deepEqual([...DIFFICULTY_IDS], ["easy", "normal", "hard"]);
    assert.equal(DEFAULT_DIFFICULTY, "normal");
    assert.equal(PRACTICE_DIFFICULTY, "easy");
    assert.ok(
      DIFFICULTY_IDS.includes(DEFAULT_DIFFICULTY) && DIFFICULTY_IDS.includes(PRACTICE_DIFFICULTY),
    );
    assert.ok(Object.isFrozen(DIFFICULTY_IDS));
  });

  it("isDifficulty: 決まった 3 つだけ true", () => {
    for (const id of DIFFICULTY_IDS) assert.equal(isDifficulty(id), true, id);
    for (const bad of [
      "EASY",
      "Normal",
      "extreme",
      "",
      "__proto__",
      "constructor",
      5,
      null,
      undefined,
      [],
      {},
      true,
    ]) {
      assert.equal(isDifficulty(bad), false, String(bad));
    }
  });
});

describe("normalizeDifficulty(1 件の検証)", () => {
  it("正しい形は、そのまま通る(凍結される)", () => {
    const out = normalizeDifficulty(VALID);
    assert.deepEqual(out, VALID);
    assert.ok(Object.isFrozen(out) && Object.isFrozen(out.modifiers));
  });

  it("id が、決まった 3 つ以外・型が違う・オブジェクトでないものは、null", () => {
    for (const bad of [
      null,
      undefined,
      "hard",
      5,
      [],
      { ...VALID, id: "extreme" },
      { ...VALID, id: "__proto__" },
    ]) {
      assert.equal(normalizeDifficulty(bad), null, JSON.stringify(bad));
    }
  });

  it("name・description が、空・長すぎる・文字でない場合は、null", () => {
    assert.equal(normalizeDifficulty({ ...VALID, name: "" }), null);
    assert.equal(normalizeDifficulty({ ...VALID, name: "あ".repeat(21) }), null);
    assert.equal(normalizeDifficulty({ ...VALID, name: 5 }), null);
    assert.equal(normalizeDifficulty({ ...VALID, description: "" }), null);
    assert.equal(normalizeDifficulty({ ...VALID, description: "あ".repeat(201) }), null);
  });

  it("rankable は真偽値だけ。unlock は null か決まった種類だけ", () => {
    assert.equal(normalizeDifficulty({ ...VALID, rankable: "true" }), null);
    assert.equal(normalizeDifficulty({ ...VALID, rankable: 1 }), null);
    assert.ok(normalizeDifficulty({ ...VALID, unlock: null }));
    assert.equal(normalizeDifficulty({ ...VALID, unlock: "boom" }), null);
    assert.equal(normalizeDifficulty({ ...VALID, unlock: "" }), null);
  });

  it("exp_multiplier・modifiers の各値は、範囲外・数でない・欠けていると、null", () => {
    assert.equal(normalizeDifficulty({ ...VALID, exp_multiplier: 0.05 }), null);
    assert.equal(normalizeDifficulty({ ...VALID, exp_multiplier: 6 }), null);
    assert.equal(normalizeDifficulty({ ...VALID, exp_multiplier: "1.6" }), null);
    assert.equal(normalizeDifficulty({ ...VALID, exp_multiplier: NaN }), null);
    for (const key of ["drain", "gain", "initial"]) {
      assert.equal(
        normalizeDifficulty({ ...VALID, modifiers: { ...VALID.modifiers, [key]: 0.2 } }),
        null,
        key,
      );
      assert.equal(
        normalizeDifficulty({ ...VALID, modifiers: { ...VALID.modifiers, [key]: 3.5 } }),
        null,
        key,
      );
      const rest = { ...VALID.modifiers };
      delete rest[key];
      assert.equal(normalizeDifficulty({ ...VALID, modifiers: rest }), null, key);
    }
    assert.equal(normalizeDifficulty({ ...VALID, modifiers: null }), null);
    assert.equal(normalizeDifficulty({ ...VALID, modifiers: "x" }), null);
  });

  it("知らない項目は捨てる。入力は書き換えない", () => {
    const input = { ...VALID, evil: "<script>", __proto__: { polluted: true } };
    const before = JSON.stringify(input);
    const out = normalizeDifficulty(input);
    assert.deepEqual(out, VALID);
    assert.equal(JSON.stringify(input), before);
    assert.equal(out.polluted, undefined);
  });
});

describe("normalizeDifficulties(一覧の検証)", () => {
  it("無効な項目・同じ id の 2 件目を、捨てる", () => {
    const list = normalizeDifficulties([
      VALID,
      { ...VALID },
      { id: "boom" },
      { ...VALID, id: "normal", name: "ふつう" },
    ]);
    assert.deepEqual(
      list.map((d) => d.id),
      ["hard", "normal"],
    );
  });

  it("配列でない場合は、空", () => {
    for (const bad of [null, undefined, "x", 5, {}])
      assert.deepEqual(normalizeDifficulties(bad), []);
  });

  it("実際のデータ(difficulties.json)が、3 つとも有効", () => {
    const raw = JSON.parse(read("public/data/difficulties.json"));
    const list = normalizeDifficulties(raw);
    assert.deepEqual(list.map((d) => d.id).sort(), ["easy", "hard", "normal"]);
  });
});

describe("applyDifficulty(役職の stage に、倍率をかける)", () => {
  const stage = {
    max_distance: 100,
    initial_distance: 60,
    drain_per_second: 2,
    base_gain: 4,
    gain_per_char: 0.5,
    difficulty_gain: 1,
    speed_gain: 3,
    speed_min_cps: 2,
    speed_max_cps: 6,
    miss_penalty: 3,
    goal_words: 14,
    word_weights: { 1: 2 },
    rules: [{ type: "shock", duration: 2, multiplier: 1.5 }],
  };

  it("ふつう(倍率 1)は、値が変わらない", () => {
    const normal = { modifiers: { drain: 1, gain: 1, initial: 1 } };
    assert.deepEqual(applyDifficulty(stage, normal), stage);
  });

  it("倍率をかけるのは、base_gain・gain_per_char・drain_per_second・initial_distance だけ", () => {
    const out = applyDifficulty(stage, VALID);
    assert.equal(out.base_gain, stage.base_gain * VALID.modifiers.gain);
    assert.equal(out.gain_per_char, stage.gain_per_char * VALID.modifiers.gain);
    assert.equal(out.drain_per_second, stage.drain_per_second * VALID.modifiers.drain);
    assert.equal(out.initial_distance, stage.initial_distance * VALID.modifiers.initial);
    for (const key of [
      "max_distance",
      "difficulty_gain",
      "speed_gain",
      "speed_min_cps",
      "speed_max_cps",
      "miss_penalty",
      "goal_words",
      "word_weights",
      "rules",
    ]) {
      assert.deepEqual(out[key], stage[key], key);
    }
  });

  it("初期距離は、最大距離を超えない(易しい難易度で、初期距離が増えすぎない)", () => {
    const easy = { modifiers: { drain: 1, gain: 1, initial: 5 } };
    const out = applyDifficulty(stage, easy);
    assert.equal(out.initial_distance, stage.max_distance);
  });

  it("元の stage を書き換えない", () => {
    const before = JSON.stringify(stage);
    applyDifficulty(stage, VALID);
    assert.equal(JSON.stringify(stage), before);
  });

  it("倍率(modifiers)がない・壊れている場合は、そのままの stage を返す", () => {
    assert.equal(applyDifficulty(stage, null), stage);
    assert.equal(applyDifficulty(stage, {}), stage);
    assert.equal(applyDifficulty(stage, undefined), stage);
  });
});

describe("isDifficultyUnlocked(難易度に、挑戦できるか)", () => {
  const clearKey = (roleId, difficulty) => `${roleId}:${difficulty}`;

  it("unlock がなければ、いつでも挑戦できる", () => {
    assert.equal(
      isDifficultyUnlocked({ unlock: null }, { difficultyClears: {}, roleId: "senpai", clearKey }),
      true,
    );
    assert.equal(
      isDifficultyUnlocked(undefined, { difficultyClears: {}, roleId: "senpai", clearKey }),
      true,
    );
  });

  it("role_clear_normal: その役職を「ふつう」で 1 回以上クリアしていること", () => {
    const difficulty = { unlock: "role_clear_normal" };
    assert.equal(
      isDifficultyUnlocked(difficulty, {
        difficultyClears: { "senpai:normal": 1 },
        roleId: "senpai",
        clearKey,
      }),
      true,
    );
    assert.equal(
      isDifficultyUnlocked(difficulty, { difficultyClears: {}, roleId: "senpai", clearKey }),
      false,
    );
    // 別の役職・違う難易度のクリアでは、解放されない
    assert.equal(
      isDifficultyUnlocked(difficulty, {
        difficultyClears: { "kakaricho:normal": 1 },
        roleId: "senpai",
        clearKey,
      }),
      false,
    );
    assert.equal(
      isDifficultyUnlocked(difficulty, {
        difficultyClears: { "senpai:hard": 1 },
        roleId: "senpai",
        clearKey,
      }),
      false,
    );
  });

  it("知らない解放の種類・difficultyClears が壊れていても、false・落ちない", () => {
    assert.equal(
      isDifficultyUnlocked(
        { unlock: "boom" },
        { difficultyClears: {}, roleId: "senpai", clearKey },
      ),
      false,
    );
    assert.equal(
      isDifficultyUnlocked(
        { unlock: "role_clear_normal" },
        { difficultyClears: null, roleId: "senpai", clearKey },
      ),
      false,
    );
  });
});

describe("difficulty.js は、DOM・保存に触れない", () => {
  it("document・window・storage・fetch を、使わない", () => {
    const source = read("public/assets/js/games/escape-boss/difficulty.js");
    assert.ok(!/\b(document|window|localStorage|sessionStorage|fetch)\b/.test(source));
  });
});
