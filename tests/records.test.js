import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRanking,
  grantExp,
  isRoleUnlocked,
  recordResult,
  unlockAchievements,
  updateProfile,
} from "../public/assets/js/games/escape-boss/records.js";
import { bestKey, clearKey } from "../public/assets/js/games/escape-boss/storage.js";
import {
  createEmptyData,
  MAX_RANKING,
  MAX_RESULTS,
} from "../public/assets/js/games/escape-boss/storage.js";
import { expForLevel } from "../public/assets/js/games/escape-boss/levels.js";

const result = (overrides = {}) => ({
  playedAt: 1000,
  jobId: "engineer",
  roleId: "senpai",
  status: "cleared",
  score: 1800,
  correct: 8,
  miss: 1,
  hits: 60,
  elapsed: 30,
  distance: 70,
  accuracy: 0.98,
  cps: 2,
  vocabularyVersion: "0.1.0",
  ...overrides,
});

describe("プレイ結果の記録", () => {
  it("クリアすると、履歴・進行状況・ランキングに記録される", () => {
    const start = createEmptyData();
    start.profile.nickname = "たろう";
    const { data, rank } = recordResult(start, result(), { titleName: "先輩超え" });
    assert.equal(rank, 1);
    assert.equal(data.results.length, 1);
    assert.equal(data.progress.totalClears, 1);
    assert.equal(data.progress.totalWords, 8);
    assert.equal(data.progress.clears.senpai, 1);
    assert.equal(data.progress.clearedJobs.engineer, true);
    const [entry] = getRanking(data, "senpai");
    assert.deepEqual(entry, {
      score: 1800,
      playedAt: 1000,
      jobId: "engineer",
      roleId: "senpai",
      nickname: "たろう",
      title: "先輩超え",
    });
  });

  it("ゲームオーバーは、履歴と累計語数だけに記録され、ランキングには載らない", () => {
    const { data, rank } = recordResult(
      createEmptyData(),
      result({ status: "gameover", correct: 3, distance: 0 }),
    );
    assert.equal(rank, null);
    assert.equal(data.results.length, 1);
    assert.equal(data.progress.totalWords, 3);
    assert.equal(data.progress.totalClears, 0);
    assert.deepEqual(data.progress.clears, {});
    assert.deepEqual(getRanking(data, "senpai"), []);
  });

  it("ランキングは役職ごとで、スコアの高い順", () => {
    let data = createEmptyData();
    for (const [roleId, score, playedAt] of [
      ["senpai", 1000, 1],
      ["senpai", 3000, 2],
      ["kakaricho", 2000, 3],
      ["senpai", 2000, 4],
    ]) {
      data = recordResult(data, result({ roleId, score, playedAt })).data;
    }
    assert.deepEqual(
      getRanking(data, "senpai").map((e) => e.score),
      [3000, 2000, 1000],
    );
    assert.deepEqual(
      getRanking(data, "kakaricho").map((e) => e.score),
      [2000],
    );
    assert.deepEqual(getRanking(data, "buchou"), []);
  });

  it("同点は先に記録したほうが上位", () => {
    let data = recordResult(createEmptyData(), result({ score: 1500, playedAt: 1 })).data;
    const out = recordResult(data, result({ score: 1500, playedAt: 2 }));
    assert.equal(out.rank, 2);
    assert.deepEqual(
      getRanking(out.data, "senpai").map((e) => e.playedAt),
      [1, 2],
    );
  });

  it("上位10件までを保持し、圏外は rank が null", () => {
    let data = createEmptyData();
    for (let i = 0; i < MAX_RANKING; i++) {
      data = recordResult(data, result({ score: 1000 + i * 100, playedAt: i })).data;
    }
    const low = recordResult(data, result({ score: 10, playedAt: 99 }));
    assert.equal(low.rank, null);
    assert.equal(getRanking(low.data, "senpai").length, MAX_RANKING);
    assert.ok(getRanking(low.data, "senpai").every((e) => e.score >= 1000));
    const top = recordResult(data, result({ score: 9999, playedAt: 100 }));
    assert.equal(top.rank, 1);
    assert.equal(getRanking(top.data, "senpai").length, MAX_RANKING);
    assert.ok(getRanking(top.data, "senpai").every((e) => e.score !== 1000));
  });

  it("履歴は直近 MAX_RESULTS 件まで(新しいものが先頭)", () => {
    let data = createEmptyData();
    for (let i = 0; i < MAX_RESULTS + 5; i++) {
      data = recordResult(data, result({ status: "gameover", playedAt: i })).data;
    }
    assert.equal(data.results.length, MAX_RESULTS);
    assert.equal(data.results[0].playedAt, MAX_RESULTS + 4);
  });

  it("元のデータを書き換えない", () => {
    const start = createEmptyData();
    recordResult(start, result());
    assert.deepEqual(start, createEmptyData());
  });
});

describe("職種ごとの合計・自己ベスト・難易度ごとのクリア数(Phase 18)", () => {
  it("職種ごとの合計(plays・clears・words・hits・miss)が、クリア・ゲームオーバーの両方で積み上がる", () => {
    let data = createEmptyData();
    data = recordResult(
      data,
      result({ jobId: "engineer", status: "cleared", correct: 8, hits: 60, miss: 1 }),
    ).data;
    data = recordResult(
      data,
      result({ jobId: "engineer", status: "gameover", correct: 3, hits: 20, miss: 5 }),
    ).data;
    assert.deepEqual(data.progress.jobs.engineer, {
      plays: 2,
      clears: 1,
      words: 11,
      hits: 80,
      miss: 6,
    });
  });

  it("職種が違えば、別々に積み上がる", () => {
    let data = createEmptyData();
    data = recordResult(data, result({ jobId: "engineer" })).data;
    data = recordResult(data, result({ jobId: "sales", correct: 5, hits: 40, miss: 2 })).data;
    assert.equal(data.progress.jobs.engineer.plays, 1);
    assert.equal(data.progress.jobs.sales.plays, 1);
    assert.equal(data.progress.jobs.sales.words, 5);
  });

  it("難易度ごとのクリア数(役職:難易度)は、クリアしたときだけ増える。既定は「ふつう」", () => {
    let data = createEmptyData();
    data = recordResult(data, result({ roleId: "senpai", status: "cleared" })).data;
    data = recordResult(data, result({ roleId: "senpai", status: "gameover" })).data;
    assert.equal(data.progress.difficultyClears[clearKey("senpai", "normal")], 1);
  });

  it("自己ベスト(職種 × 役職 × 難易度)は、スコアが上回ったときだけ更新される", () => {
    let data = createEmptyData();
    data = recordResult(data, result({ score: 1000, playedAt: 1 })).data;
    const key = bestKey("engineer", "senpai", "normal");
    assert.deepEqual(data.progress.bests[key], { score: 1000, playedAt: 1 });
    data = recordResult(data, result({ score: 800, playedAt: 2 })).data;
    assert.equal(data.progress.bests[key].score, 1000, "低いスコアでは、更新しない");
    data = recordResult(data, result({ score: 1500, playedAt: 3 })).data;
    assert.deepEqual(data.progress.bests[key], { score: 1500, playedAt: 3 });
  });

  it("ゲームオーバーでは、自己ベスト・難易度ごとのクリア数は増えない", () => {
    const data = recordResult(createEmptyData(), result({ status: "gameover" })).data;
    assert.deepEqual(data.progress.bests, {});
    assert.deepEqual(data.progress.difficultyClears, {});
  });

  it("元のデータを書き換えない(進行状況の新しい項目も含めて)", () => {
    const start = createEmptyData();
    recordResult(start, result());
    assert.deepEqual(start, createEmptyData());
  });
});

describe("grantExp(経験値の付与)", () => {
  it("結果から経験値を計算し、進行状況の exp に足す", () => {
    const progress = { ...createEmptyData().progress, exp: 100 };
    const out = grantExp(progress, result({ status: "cleared", correct: 8 }));
    assert.equal(out.gained, 8 * 10 + 100);
    assert.equal(out.progress.exp, 100 + out.gained);
  });

  it("新しく解放した実績の数・難易度の倍率を、そのまま expForResult に渡す", () => {
    const progress = { ...createEmptyData().progress, exp: 0 };
    const out = grantExp(progress, result({ status: "cleared", correct: 5 }), {
      newAchievements: 2,
      multiplier: 2,
    });
    assert.equal(out.gained, (5 * 10 + 100 + 2 * 50) * 2);
  });

  it("レベルが上がったときだけ、levelUp に { from, to } が入る", () => {
    const justBelow = { ...createEmptyData().progress, exp: expForLevel(3) - 5 };
    const up = grantExp(justBelow, result({ status: "cleared", correct: 1 }));
    assert.ok(up.levelUp === null || up.levelUp.to > up.levelUp.from);
    const noChange = grantExp(
      { ...createEmptyData().progress, exp: 0 },
      result({ status: "gameover", correct: 0 }),
    );
    assert.equal(noChange.levelUp, null);
  });

  it("進行状況の、exp 以外の項目は変わらない", () => {
    const progress = {
      ...createEmptyData().progress,
      jobs: { engineer: { plays: 1, clears: 1, words: 8, hits: 60, miss: 1 } },
    };
    const out = grantExp(progress, result());
    assert.deepEqual(out.progress.jobs, progress.jobs);
  });
});

describe("役職の解放", () => {
  const kaicho = {
    id: "kaicho",
    unlock: { type: "clear_roles", roles: ["senpai", "kakaricho", "buchou", "shachou"] },
  };

  it("unlock がない役職は最初から挑戦できる", () => {
    assert.equal(isRoleUnlocked(createEmptyData(), { id: "senpai" }), true);
  });

  it("会長は、指定の役職をすべてクリアするまで解放されない", () => {
    let data = createEmptyData();
    assert.equal(isRoleUnlocked(data, kaicho), false);
    for (const roleId of ["senpai", "kakaricho", "buchou"]) {
      data = recordResult(data, result({ roleId })).data;
    }
    assert.equal(isRoleUnlocked(data, kaicho), false);
    data = recordResult(data, result({ roleId: "shachou", jobId: "sales" })).data;
    assert.equal(isRoleUnlocked(data, kaicho), true);
  });

  it("ゲームオーバーでは解放が進まない", () => {
    const data = recordResult(
      createEmptyData(),
      result({ roleId: "senpai", status: "gameover" }),
    ).data;
    assert.equal(
      isRoleUnlocked(data, { unlock: { type: "clear_roles", roles: ["senpai"] } }),
      false,
    );
  });

  it("未知の解放条件は解放しない", () => {
    assert.equal(isRoleUnlocked(createEmptyData(), { unlock: { type: "?" } }), false);
  });
});

describe("実績の記録とプロフィール", () => {
  it("実績は初回の日時を保持し、二重に上書きしない", () => {
    const first = unlockAchievements(createEmptyData(), ["a", "b"], 100);
    const second = unlockAchievements(first, ["b", "c"], 200);
    assert.deepEqual(second.achievements, { a: 100, b: 100, c: 200 });
    assert.equal(unlockAchievements(first, [], 300), first);
  });

  it("プロフィールを更新できる。選べない称号は既定に戻る", () => {
    const data = createEmptyData();
    const ok = updateProfile(data, { nickname: "たろう", titleId: "clear-senpai" }, [
      "newbie",
      "clear-senpai",
    ]);
    assert.deepEqual(ok.profile, { nickname: "たろう", titleId: "clear-senpai" });
    const bad = updateProfile(ok, { nickname: "たろう", titleId: "clear-kaicho" }, ["newbie"]);
    assert.equal(bad.profile.titleId, "newbie");
  });

  it("ニックネームは整えられる", () => {
    const data = updateProfile(createEmptyData(), { nickname: "  " + "あ".repeat(20) + "\n" }, [
      "newbie",
    ]);
    assert.equal(data.profile.nickname, "あ".repeat(12));
  });
});
