// functions/_lib/ranking-limits.js(オンラインランキングの、送られてきたスコアの妥当性検査)のテスト。
// 実際の public/data/roles.json・difficulties.json・jobs.json と、値がそろっているかを検査する
// (ずれると、正しいスコアまで断ってしまう・不正なスコアを通してしまう、のどちらかが起きるため)。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DIFFICULTY_RANKABLE,
  JOB_IDS,
  MAX_CPS,
  ROLE_LIMITS,
  isKnownDifficulty,
  isKnownJob,
  isKnownRole,
  isPlausibleScore,
  isRankableDifficulty,
  maxScoreFor,
} from "../functions/_lib/ranking-limits.js";
import { SCORE_RULES } from "../public/assets/js/games/escape-boss/score.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => JSON.parse(readFileSync(`${root}${path}`, "utf8"));
const roles = read("public/data/roles.json");
const difficulties = read("public/data/difficulties.json");
const jobs = read("public/data/jobs.json");

describe("ROLE_LIMITS は、実際の roles.json と、そろっている", () => {
  it("役職の一覧が、同じ(過不足なし)", () => {
    assert.deepEqual(Object.keys(ROLE_LIMITS).sort(), roles.map((r) => r.id).sort());
  });

  it("目標語数・最大距離・スコアの倍率が、同じ値", () => {
    for (const role of roles) {
      const limit = ROLE_LIMITS[role.id];
      assert.equal(limit.goalWords, role.stage.goal_words, role.id);
      assert.equal(limit.maxDistance, role.stage.max_distance, role.id);
      assert.equal(limit.multiplier, role.score_multiplier, role.id);
    }
  });
});

describe("DIFFICULTY_RANKABLE は、実際の difficulties.json と、そろっている", () => {
  it("難易度の一覧と rankable が、同じ", () => {
    assert.deepEqual(Object.keys(DIFFICULTY_RANKABLE).sort(), difficulties.map((d) => d.id).sort());
    for (const difficulty of difficulties) {
      assert.equal(DIFFICULTY_RANKABLE[difficulty.id], difficulty.rankable, difficulty.id);
    }
  });
});

describe("JOB_IDS は、実際の jobs.json と、そろっている", () => {
  it("職種の一覧が、同じ(過不足なし)", () => {
    assert.deepEqual([...JOB_IDS].sort(), jobs.map((j) => j.id).sort());
  });
});

describe("isKnownRole・isKnownDifficulty・isRankableDifficulty・isKnownJob", () => {
  it("知っている値は true、知らない値・不正な型は false", () => {
    assert.equal(isKnownRole("senpai"), true);
    assert.equal(isKnownRole("bucho"), false); // 綴りが違う
    assert.equal(isKnownRole(undefined), false);
    assert.equal(isKnownDifficulty("normal"), true);
    assert.equal(isKnownDifficulty("extreme"), false);
    assert.equal(isRankableDifficulty("normal"), true);
    assert.equal(isRankableDifficulty("easy"), false); // やさしいは、ランキングの対象外
    assert.equal(isRankableDifficulty("extreme"), false);
    assert.equal(isKnownJob("engineer"), true);
    assert.equal(isKnownJob("__proto__"), false);
  });
});

describe("maxScoreFor(理論上ありうる最大のスコア)", () => {
  it("役職ごとに、公開のスコア式(SCORE_RULES)から計算する", () => {
    for (const role of roles) {
      const expected = Math.round(
        (role.stage.goal_words * SCORE_RULES.perWord +
          SCORE_RULES.clearBonus +
          role.stage.max_distance * SCORE_RULES.perMeter +
          100 * SCORE_RULES.perAccuracyPercent +
          MAX_CPS * SCORE_RULES.perKeystrokePerSecond) *
          role.score_multiplier,
      );
      assert.equal(maxScoreFor(role.id), expected, role.id);
    }
  });

  it("役職が進むほど、上限も上がる(倍率・目標語数が増えるため)", () => {
    const values = roles.map((r) => maxScoreFor(r.id));
    for (let i = 1; i < values.length; i += 1) assert.ok(values[i] > values[i - 1]);
  });

  it("知らない役職は 0", () => {
    assert.equal(maxScoreFor("unknown"), 0);
  });
});

describe("isPlausibleScore", () => {
  it("0以上・上限以下の整数だけ、通す", () => {
    assert.equal(isPlausibleScore("senpai", 0), true);
    assert.equal(isPlausibleScore("senpai", maxScoreFor("senpai")), true);
    assert.equal(isPlausibleScore("senpai", maxScoreFor("senpai") + 1), false);
    assert.equal(isPlausibleScore("senpai", -1), false);
    assert.equal(isPlausibleScore("senpai", 1.5), false);
    assert.equal(isPlausibleScore("senpai", Number.NaN), false);
    assert.equal(isPlausibleScore("senpai", "100"), false);
    assert.equal(isPlausibleScore("unknown", 0), false); // 上限 0 なので、0 も通さない
  });

  it("改ざんされた、あり得ないスコアは、断る(0004決定ログ: オンラインランキングはサーバー側で検証する)", () => {
    assert.equal(isPlausibleScore("kaicho", 999_999), false);
  });
});
