// 経験値・レベル(Phase 18 PR 1)のテスト: levels.js(DOM・保存・時計に触れない純粋な計算)。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  EXP_RULES,
  LEVEL_CURVE,
  MAX_EXP,
  MAX_LEVEL,
  addExp,
  expForLevel,
  expForResult,
  initialExp,
  levelOf,
  levelUp,
} from "../public/assets/js/games/escape-boss/levels.js";

describe("expForLevel(必要な累計の経験値)", () => {
  it("レベル 1 は 0。レベルが上がるほど、必要な経験値も増える(なだらかに)", () => {
    assert.equal(expForLevel(1), 0);
    let previous = 0;
    for (let level = 2; level <= MAX_LEVEL; level += 1) {
      const need = expForLevel(level);
      assert.ok(need > previous, `${level}: ${need} <= ${previous}`);
      previous = need;
    }
  });

  it("10 の位に丸められる", () => {
    for (let level = 1; level <= MAX_LEVEL; level += 1) assert.equal(expForLevel(level) % 10, 0);
  });

  it("範囲外のレベルは、1〜50 に収める。数でない値は、レベル 1 として扱う", () => {
    assert.equal(expForLevel(0), expForLevel(1));
    assert.equal(expForLevel(-5), expForLevel(1));
    assert.equal(expForLevel(999), expForLevel(MAX_LEVEL));
    assert.equal(expForLevel(3.9), expForLevel(3));
    for (const bad of [NaN, Infinity, "5", null, undefined]) {
      assert.equal(expForLevel(bad), expForLevel(1), String(bad));
    }
  });

  it("曲線の定数(base・power)から計算する。数値を変えると、必要量も変わる(調整できる)", () => {
    assert.equal(LEVEL_CURVE.base, 60);
    assert.equal(LEVEL_CURVE.power, 1.7);
    const expected = Math.round((60 * 9 ** 1.7) / 10) * 10;
    assert.equal(expForLevel(10), expected);
  });
});

describe("levelOf(累計の経験値から、レベルと様子を求める)", () => {
  it("0 は、レベル 1・into 0・ratio 0", () => {
    const info = levelOf(0);
    assert.equal(info.level, 1);
    assert.equal(info.into, 0);
    assert.equal(info.ratio, 0);
    assert.equal(info.levelStart, 0);
  });

  it("ちょうど境目の経験値は、上がった側のレベルになる", () => {
    const boundary = expForLevel(5);
    assert.equal(levelOf(boundary).level, 5);
    assert.equal(levelOf(boundary - 1).level, 4);
  });

  it("into・needed・remaining・ratio が、つじつまが合う", () => {
    const info = levelOf(expForLevel(6) + 15);
    assert.equal(info.level, 6);
    assert.equal(info.into + info.remaining, info.needed);
    assert.equal(info.levelStart + info.into, info.exp);
    assert.ok(info.ratio > 0 && info.ratio < 1);
  });

  it("最高レベルでは、nextAt が null、remaining 0、ratio 1", () => {
    const info = levelOf(expForLevel(MAX_LEVEL) + 100_000);
    assert.equal(info.level, MAX_LEVEL);
    assert.equal(info.nextAt, null);
    assert.equal(info.remaining, 0);
    assert.equal(info.ratio, 1);
  });

  it("負の値・数でない値は、0 として扱う(落ちない)", () => {
    for (const bad of [-100, NaN, Infinity, "5", null, undefined, {}, []]) {
      assert.equal(levelOf(bad).level, 1, String(bad));
      assert.equal(levelOf(bad).exp, 0, String(bad));
    }
  });

  it("上限(MAX_EXP)を超える値は、上限に丸める", () => {
    assert.equal(levelOf(MAX_EXP * 2).exp, MAX_EXP);
  });
});

describe("expForResult(1 プレイで得る経験値)", () => {
  it("正解語数 × 10 + クリア 100(クリアのときだけ)。既定の倍率は 1", () => {
    assert.equal(EXP_RULES.perWord, 10);
    assert.equal(EXP_RULES.clearBonus, 100);
    assert.equal(EXP_RULES.perAchievement, 50);
    assert.equal(expForResult({ status: "cleared", correct: 10 }), 200);
    assert.equal(expForResult({ status: "gameover", correct: 6 }), 60);
  });

  it("新しく解放した実績の数だけ、加算される", () => {
    assert.equal(
      expForResult({ status: "cleared", correct: 5 }, { newAchievements: 2 }),
      5 * 10 + 100 + 2 * 50,
    );
  });

  it("難易度の倍率をかける(小数点は切り捨て)", () => {
    assert.equal(expForResult({ status: "cleared", correct: 10 }, { multiplier: 1.5 }), 300);
    assert.equal(expForResult({ status: "gameover", correct: 3 }, { multiplier: 1.5 }), 45);
  });

  it("不正な倍率(0・負・数でない)は、1 として扱う", () => {
    const base = expForResult({ status: "cleared", correct: 10 });
    for (const bad of [0, -1, NaN, Infinity, "2", null, undefined]) {
      assert.equal(
        expForResult({ status: "cleared", correct: 10 }, { multiplier: bad }),
        base,
        String(bad),
      );
    }
  });

  it("正解語数・新しい実績の数が、不正・負・極端に大きい値でも、落ちない(上限まで)", () => {
    assert.equal(expForResult({ status: "cleared", correct: -5 }), 100);
    assert.equal(expForResult({ status: "cleared", correct: NaN }), 100);
    assert.equal(expForResult({ status: "cleared", correct: 1e9 }), 1000 * 10 + 100);
    assert.equal(expForResult({ status: "cleared", correct: 5 }, { newAchievements: -3 }), 150);
    // newAchievements は、100 件までに丸める(MAX_ACHIEVEMENTS)
    assert.equal(
      expForResult({ status: "cleared", correct: 5 }, { newAchievements: 1e9 }),
      5 * 10 + 100 + 100 * 50,
    );
  });

  it("result が、null・不完全でも、落ちない", () => {
    assert.equal(expForResult(null), 0);
    assert.equal(expForResult({}), 0);
    assert.equal(expForResult(undefined), 0);
  });
});

describe("addExp・initialExp", () => {
  it("足し算。上限(MAX_EXP)を超えない", () => {
    assert.equal(addExp(100, 50), 150);
    assert.equal(addExp(MAX_EXP - 10, 100), MAX_EXP);
  });

  it("不正な値(負・数でない)は、0 として扱う", () => {
    assert.equal(addExp(-5, 100), 100);
    assert.equal(addExp(100, -5), 100);
    assert.equal(addExp(NaN, 100), 100);
    assert.equal(addExp(100, NaN), 100);
  });

  it("以前の記録(累計の正解語数・クリア数・実績数)から、最初の累計の経験値を作る", () => {
    assert.equal(initialExp({ totalWords: 50, totalClears: 3 }, 4), 50 * 10 + 3 * 100 + 4 * 50);
  });

  it("progress がない・壊れていても、0 から作る(落ちない)", () => {
    assert.equal(initialExp(undefined), 0);
    assert.equal(initialExp(null, 2), 2 * 50);
    assert.equal(initialExp({ totalWords: "x", totalClears: -1 }, 0), 0);
  });
});

describe("levelUp(レベルが上がったか)", () => {
  it("上がっていれば { from, to }、上がっていなければ null", () => {
    const before = expForLevel(4);
    const after = expForLevel(4) + expForResult({ status: "cleared", correct: 30 });
    const up = levelUp(before, after);
    assert.ok(up && up.from === 4 && up.to > 4);
    assert.equal(levelUp(before, before + 1 < expForLevel(5) ? before + 1 : before), null);
  });

  it("同じレベルの中の増加では、null", () => {
    assert.equal(levelUp(expForLevel(3), expForLevel(4) - 1), null);
  });

  it("2 段階以上、一気に上がることもある", () => {
    const up = levelUp(0, expForLevel(3) + 5);
    assert.ok(up.from === 1 && up.to === 3);
  });
});

describe("levels.js は、DOM・保存・時計に触れない", () => {
  it("document・window・storage・Date・performance を、使わない", () => {
    const source = readFileSync(
      new URL("../public/assets/js/games/escape-boss/levels.js", import.meta.url),
      "utf8",
    );
    assert.ok(
      !/\b(document|window|localStorage|sessionStorage|Date|performance|fetch)\b/.test(source),
    );
  });
});
