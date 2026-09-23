import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  averageDifficulty,
  bestScoreHistory,
  bestScoreTable,
  buildSeries,
  compareRecent,
  countWithKeyData,
  DIFFICULTY_LABELS,
  difficultyBreakdown,
  difficultyLabel,
  formatDuration,
  hasTyping,
  METRICS,
  summarizeDetails,
  summarizeResults,
} from "../public/assets/js/games/escape-boss/stats.js";
import { bestKey } from "../public/assets/js/games/escape-boss/storage.js";

// 新しいものが先頭(playedAt が大きい順)
function result(overrides = {}) {
  return {
    playedAt: 1000,
    jobId: "engineer",
    roleId: "senpai",
    status: "cleared",
    score: 1000,
    correct: 8,
    miss: 2,
    hits: 60,
    elapsed: 30,
    distance: 50,
    accuracy: 0.9,
    cps: 2,
    keys: {},
    confusions: {},
    wordMisses: {},
    difficulty: "normal",
    ...overrides,
  };
}

describe("指標", () => {
  it("入力速度は打鍵/秒を打/分にし、正確率は%にする", () => {
    const r = result({ cps: 2.5, accuracy: 0.875, score: 1234 });
    assert.equal(METRICS.cpm.value(r), 150);
    assert.equal(METRICS.accuracy.value(r), 87.5);
    assert.equal(METRICS.score.value(r), 1234);
  });

  it("打鍵のないプレイかどうか", () => {
    assert.equal(hasTyping(result()), true);
    assert.equal(hasTyping(result({ hits: 0, miss: 3 })), true);
    assert.equal(hasTyping(result({ hits: 0, miss: 0 })), false);
  });
});

describe("累計の成績", () => {
  it("記録がなければ、すべて 0", () => {
    assert.deepEqual(summarizeResults([]), {
      plays: 0,
      clears: 0,
      clearRate: 0,
      totalWords: 0,
      totalSeconds: 0,
      bestCpm: 0,
      bestAccuracy: 0,
    });
  });

  it("回数・クリア率・語数・時間・最高値を集計する", () => {
    const summary = summarizeResults([
      result({ status: "cleared", correct: 8, elapsed: 30, cps: 2, accuracy: 0.9 }),
      result({ status: "gameover", correct: 3, elapsed: 20, cps: 3, accuracy: 0.8 }),
      result({ status: "cleared", correct: 8, elapsed: 25.4, cps: 2.5, accuracy: 0.95 }),
      result({ status: "cleared", correct: 9, elapsed: 40, cps: 1, accuracy: 1 }),
    ]);
    assert.equal(summary.plays, 4);
    assert.equal(summary.clears, 3);
    assert.equal(summary.clearRate, 0.75);
    assert.equal(summary.totalWords, 28);
    assert.equal(summary.totalSeconds, 115.4);
    assert.equal(summary.bestCpm, 180);
    assert.equal(summary.bestAccuracy, 100);
  });

  it("打鍵のないプレイは、最高値の対象にしない", () => {
    const summary = summarizeResults([
      result({ hits: 0, miss: 0, cps: 0, accuracy: 0 }),
      result({ cps: 1, accuracy: 0.5 }),
    ]);
    assert.equal(summary.bestCpm, 60);
    assert.equal(summary.plays, 2);
  });
});

describe("ハイスコア表(bestScoreTable。Phase 18 PR 4)", () => {
  const scope = {
    jobIds: ["engineer", "sales"],
    roleIds: ["senpai", "buchou"],
    difficultyIds: ["easy", "normal", "hard"],
    bestKey,
  };

  it("役職 × 難易度ごとに、最高スコアの職種を1行にする(役職・難易度の並び順)", () => {
    const bests = {
      [bestKey("engineer", "senpai", "normal")]: { score: 1500, playedAt: 4 },
      [bestKey("sales", "senpai", "normal")]: { score: 1800, playedAt: 5 },
      [bestKey("engineer", "senpai", "hard")]: { score: 900, playedAt: 6 },
      [bestKey("engineer", "buchou", "easy")]: { score: 2000, playedAt: 2 },
    };
    const rows = bestScoreTable(bests, scope);
    assert.deepEqual(
      rows.map((r) => [r.roleId, r.difficulty, r.jobId, r.score]),
      [
        ["senpai", "normal", "sales", 1800],
        ["senpai", "hard", "engineer", 900],
        ["buchou", "easy", "engineer", 2000],
      ],
    );
  });

  it("記録がなければ、空の一覧", () => {
    assert.deepEqual(bestScoreTable({}, scope), []);
    assert.deepEqual(bestScoreTable(null, scope), []);
  });
});

describe("自己ベストの更新履歴(bestScoreHistory。Phase 18 PR 4)", () => {
  it("職種 × 役職 × 難易度ごとに、最高スコアが更新された瞬間だけを、更新順(新しい順)で返す", () => {
    // playedAt が大きいほど新しい。渡す配列は、新しい順(保存の形)
    const list = [
      result({ playedAt: 4, score: 1500, roleId: "senpai" }), // 3番目の更新
      result({ playedAt: 3, score: 800, roleId: "senpai", status: "gameover" }), // クリアでないので無視
      result({ playedAt: 2, score: 1200, roleId: "senpai" }), // 2番目の更新
      result({ playedAt: 1, score: 900, roleId: "senpai" }), // 最初の記録
    ];
    const history = bestScoreHistory(list, bestKey);
    assert.deepEqual(
      history.map((m) => [m.playedAt, m.score, m.previousScore]),
      [
        [4, 1500, 1200],
        [2, 1200, 900],
        [1, 900, null],
      ],
    );
  });

  it("スコアが自己ベストを更新しないプレイは、記録しない", () => {
    const list = [
      result({ playedAt: 3, score: 500, roleId: "senpai" }),
      result({ playedAt: 2, score: 1500, roleId: "senpai" }),
      result({ playedAt: 1, score: 900, roleId: "senpai" }),
    ];
    const history = bestScoreHistory(list, bestKey);
    assert.deepEqual(
      history.map((m) => m.playedAt),
      [2, 1],
    );
  });

  it("職種・役職・難易度が違えば、別の組として、それぞれ更新を数える", () => {
    const list = [
      result({ playedAt: 2, score: 100, roleId: "buchou" }),
      result({ playedAt: 1, score: 100, roleId: "senpai" }),
    ];
    const history = bestScoreHistory(list, bestKey);
    assert.equal(history.length, 2);
  });

  it("最大 limit 件(既定10件)、新しい順", () => {
    // 新しい順(保存の形)。playedAt が大きいほど新しく、スコアも右肩上がりに更新され続ける想定
    const list = Array.from({ length: 15 }, (_, i) =>
      result({ playedAt: 15 - i, score: 15 - i, roleId: "senpai" }),
    );
    const history = bestScoreHistory(list, bestKey);
    assert.equal(history.length, 10);
    assert.equal(history[0].playedAt, 15);
    assert.equal(history[9].playedAt, 6);
    assert.equal(bestScoreHistory(list, bestKey, { limit: 3 }).length, 3);
  });

  it("記録がなければ、空", () => {
    assert.deepEqual(bestScoreHistory([], bestKey), []);
  });
});

describe("直近との比較", () => {
  const plays = (count, cps, accuracy, start = 0) =>
    Array.from({ length: count }, (_, i) => result({ cps, accuracy, playedAt: start + i }));

  it("直近と、その前の平均を返す(新しいものが先頭)", () => {
    const list = [...plays(10, 3, 0.95), ...plays(10, 2, 0.85)];
    const { recent, previous } = compareRecent(list);
    assert.equal(recent.count, 10);
    assert.equal(recent.cpm, 180);
    assert.ok(Math.abs(recent.accuracy - 95) < 1e-9);
    assert.equal(previous.cpm, 120);
    assert.ok(Math.abs(previous.accuracy - 85) < 1e-9);
  });

  it("その前が少なすぎれば、比べない(null)", () => {
    assert.equal(compareRecent(plays(12, 2, 0.9)).previous, null);
    assert.ok(compareRecent(plays(13, 2, 0.9)).previous !== null);
  });

  it("記録がなければ 0 件", () => {
    const { recent, previous } = compareRecent([]);
    assert.equal(recent.count, 0);
    assert.equal(recent.cpm, 0);
    assert.equal(previous, null);
  });

  it("打鍵のないプレイは平均に入れない", () => {
    const { recent } = compareRecent([result({ hits: 0, miss: 0, cps: 0 }), result({ cps: 2 })]);
    assert.equal(recent.count, 1);
    assert.equal(recent.cpm, 120);
  });
});

describe("成長グラフ用の点", () => {
  const list = [
    result({ playedAt: 5, cps: 5, accuracy: 0.5, score: 500 }),
    result({
      playedAt: 4,
      cps: 4,
      accuracy: 0.6,
      score: 400,
      roleId: "buchou",
      status: "gameover",
    }),
    result({ playedAt: 3, cps: 3, accuracy: 0.7, score: 300 }),
    result({ playedAt: 2, cps: 0, accuracy: 0, score: 0, hits: 0, miss: 0, status: "gameover" }),
    result({ playedAt: 1, cps: 1, accuracy: 0.9, score: 100 }),
  ];

  it("古い順に並べ、1から番号を付ける", () => {
    const series = buildSeries(list, { metric: "score" });
    assert.deepEqual(
      series.map((p) => [p.n, p.value, p.playedAt]),
      [
        [1, 100, 1],
        [2, 0, 2],
        [3, 300, 3],
        [4, 400, 4],
        [5, 500, 5],
      ],
    );
  });

  it("入力速度と正確率は、打鍵のないプレイを除く", () => {
    assert.deepEqual(
      buildSeries(list, { metric: "cpm" }).map((p) => p.value),
      [60, 180, 240, 300],
    );
    assert.deepEqual(
      buildSeries(list, { metric: "accuracy" }).map((p) => Math.round(p.value)),
      [90, 70, 60, 50],
    );
  });

  it("役職で絞り込める", () => {
    const series = buildSeries(list, { metric: "score", roleId: "buchou" });
    assert.deepEqual(
      series.map((p) => [p.value, p.roleId, p.status]),
      [[400, "buchou", "gameover"]],
    );
  });

  it("直近 limit 回だけを使い、その中を古い順に並べる", () => {
    const series = buildSeries(list, { metric: "score", limit: 2 });
    assert.deepEqual(
      series.map((p) => p.playedAt),
      [4, 5],
    );
    assert.deepEqual(
      series.map((p) => p.n),
      [1, 2],
    );
  });

  it("既定は入力速度・全役職・直近30回", () => {
    const many = Array.from({ length: 50 }, (_, i) => result({ playedAt: 50 - i }));
    const series = buildSeries(many);
    assert.equal(series.length, 30);
    assert.equal(series[0].playedAt, 21);
    assert.equal(series[29].playedAt, 50);
  });

  it("記録がなければ空", () => {
    assert.deepEqual(buildSeries([]), []);
  });
});

describe("表示用", () => {
  it("秒数を読みやすくする", () => {
    assert.equal(formatDuration(0), "0秒");
    assert.equal(formatDuration(45.4), "45秒");
    assert.equal(formatDuration(59.6), "1分0秒");
    assert.equal(formatDuration(754), "12分34秒");
    assert.equal(formatDuration(3 * 3600 + 5 * 60 + 9), "3時間5分");
    assert.equal(formatDuration(-5), "0秒");
  });

  it("キー別の記録があるプレイの数を数える", () => {
    const list = [
      result({ keys: { a: { hits: 1, misses: 0 } } }),
      result(),
      result({ keys: undefined }),
      result({ keys: { b: { hits: 2, misses: 1 } } }),
    ];
    assert.equal(countWithKeyData(list), 2);
  });
});

// ---- 連続ノーミス・難易度・残り距離(Phase 13 PR 3) ----
const withDetails = (overrides = {}) =>
  result({ streak: 5, wordsByDifficulty: { 1: 2, 2: 4, 3: 2 }, wordMisses: {}, ...overrides });
// 以前のプレイ(バージョン 1・2)。記録は null
const oldPlay = (overrides = {}) =>
  result({ streak: null, wordsByDifficulty: null, wordMisses: {}, ...overrides });

describe("語の難しさの平均(averageDifficulty)", () => {
  it("難易度ごとの語数から、語の数で重みをつけて平均する", () => {
    assert.equal(averageDifficulty({ 1: 2, 2: 4, 3: 2 }), 2);
    assert.equal(averageDifficulty({ 3: 4 }), 3);
    assert.ok(Math.abs(averageDifficulty({ 1: 3, 3: 1 }) - 1.5) < 1e-9);
  });

  it("語がない・形が違うときは null(0 とは区別する)", () => {
    for (const value of [null, undefined, {}, { 1: 0 }, [], "x", 5]) {
      assert.equal(averageDifficulty(value), null, String(value));
    }
  });
});

describe("成績のまとめの追加項目(summarizeDetails)", () => {
  it("最大の連続ノーミスは、記録のあるプレイの最大", () => {
    const details = summarizeDetails([
      withDetails({ streak: 3 }),
      withDetails({ streak: 9 }),
      withDetails({ streak: 0 }),
    ]);
    assert.equal(details.bestStreak, 9);
    assert.equal(details.streakPlays, 3);
  });

  it("連続の記録が 0 のプレイも、記録あり(0 は 0)。以前のプレイ(null)は、対象から除く", () => {
    assert.equal(summarizeDetails([withDetails({ streak: 0 })]).bestStreak, 0);
    const mixed = summarizeDetails([oldPlay(), withDetails({ streak: 4 }), oldPlay()]);
    assert.equal(mixed.bestStreak, 4);
    assert.equal(mixed.streakPlays, 1);
  });

  it("記録のあるプレイがなければ、null(以前のプレイだけ・プレイなし)", () => {
    for (const list of [[], [oldPlay(), oldPlay()]]) {
      const details = summarizeDetails(list);
      assert.equal(details.bestStreak, null);
      assert.equal(details.avgDifficulty, null);
      assert.equal(details.streakPlays, 0);
      assert.equal(details.difficultyPlays, 0);
    }
  });

  it("平均の残り距離は、クリアしたプレイだけ(ゲームオーバーは、除く)", () => {
    const details = summarizeDetails([
      result({ status: "cleared", distance: 40 }),
      result({ status: "cleared", distance: 60 }),
      result({ status: "gameover", distance: 0 }),
    ]);
    assert.equal(details.avgRemaining, 50);
    assert.equal(details.clears, 2);
  });

  it("クリアがなければ、平均の残り距離は null", () => {
    assert.equal(
      summarizeDetails([result({ status: "gameover", distance: 0 })]).avgRemaining,
      null,
    );
    assert.equal(summarizeDetails([]).avgRemaining, null);
  });

  it("平均の難しさは、プレイをまたいで、語の数で重みをつける。以前のプレイは、除く", () => {
    const details = summarizeDetails([
      withDetails({ wordsByDifficulty: { 1: 6 } }),
      withDetails({ wordsByDifficulty: { 3: 2 } }),
      oldPlay(),
    ]);
    assert.equal(details.avgDifficulty, (6 * 1 + 2 * 3) / 8);
    assert.equal(details.difficultyPlays, 2);
  });

  it("難易度ごとの語数が空({})のプレイは、対象から除く(語を 1 つも打っていない)", () => {
    const details = summarizeDetails([withDetails({ wordsByDifficulty: {} })]);
    assert.equal(details.avgDifficulty, null);
    assert.equal(details.difficultyPlays, 0);
  });

  it("入力を書き換えない", () => {
    const list = [withDetails(), oldPlay()];
    const before = JSON.stringify(list);
    summarizeDetails(list);
    assert.equal(JSON.stringify(list), before);
  });
});

describe("難易度別のミス(difficultyBreakdown)", () => {
  const difficultyOf = (id) => ({ "a-1": 1, "a-2": 2, "a-3": 3, "a-4": 3 })[id];

  it("難易度ごとの、打った語数・ミスの数・1 語あたりのミスを出す", () => {
    const { rows, plays } = difficultyBreakdown(
      [
        withDetails({
          wordsByDifficulty: { 1: 2, 2: 4, 3: 2 },
          wordMisses: { "a-1": 1, "a-3": 2 },
        }),
        withDetails({
          wordsByDifficulty: { 1: 2, 3: 2 },
          wordMisses: { "a-3": 1, "a-4": 1, "a-2": 2 },
        }),
      ],
      difficultyOf,
    );
    assert.equal(plays, 2);
    assert.deepEqual(
      rows.map((row) => [row.difficulty, row.label, row.words, row.misses, row.perWord]),
      [
        [1, "やさしい", 4, 1, 0.25],
        [2, "ふつう", 4, 2, 0.5],
        [3, "むずかしい", 4, 4, 1],
      ],
    );
  });

  it("難易度ごとの語数の記録がないプレイ(以前のプレイ)は、ミスも含めて、除く(割合の分母をそろえる)", () => {
    const { rows, plays } = difficultyBreakdown(
      [
        withDetails({ wordsByDifficulty: { 1: 4 }, wordMisses: { "a-1": 1 } }),
        oldPlay({ wordMisses: { "a-1": 9 } }),
      ],
      difficultyOf,
    );
    assert.equal(plays, 1);
    assert.deepEqual(
      rows.map((row) => [row.words, row.misses]),
      [[4, 1]],
    );
  });

  it("語録にない語・難易度がわからない語・不正なミスの数は、数えない", () => {
    const { rows } = difficultyBreakdown(
      [
        withDetails({
          wordsByDifficulty: { 1: 3 },
          wordMisses: { gone: 5, "a-1": 0, "a-2": -1, "a-3": "x", "a-4": NaN },
        }),
      ],
      difficultyOf,
    );
    assert.deepEqual(
      rows.map((row) => [row.difficulty, row.words, row.misses]),
      [[1, 3, 0]],
    );
  });

  it("語は打ったが、ミスがなければ、1 語あたりのミスは 0。ミスだけで語数のない難易度は、null", () => {
    const { rows } = difficultyBreakdown(
      [withDetails({ wordsByDifficulty: { 1: 2 }, wordMisses: { "a-3": 1 } })],
      difficultyOf,
    );
    assert.deepEqual(
      rows.map((row) => [row.difficulty, row.perWord]),
      [
        [1, 0],
        [3, null],
      ],
    );
  });

  it("対象のプレイがなければ、行はない。範囲外の難易度にも、名前がつく", () => {
    assert.deepEqual(difficultyBreakdown([], difficultyOf), { rows: [], plays: 0 });
    assert.deepEqual(difficultyBreakdown([oldPlay()], difficultyOf), { rows: [], plays: 0 });
    assert.equal(difficultyLabel(2), "ふつう");
    assert.equal(difficultyLabel(5), "難易度 5");
    assert.deepEqual(Object.keys(DIFFICULTY_LABELS), ["1", "2", "3"]);
  });

  it("入力を書き換えない", () => {
    const list = [withDetails({ wordMisses: { "a-1": 1 } })];
    const before = JSON.stringify(list);
    difficultyBreakdown(list, difficultyOf);
    assert.equal(JSON.stringify(list), before);
  });
});
