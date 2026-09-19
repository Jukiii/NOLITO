import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bestScoresByRole,
  buildSeries,
  compareRecent,
  countWithKeyData,
  formatDuration,
  hasTyping,
  METRICS,
  summarizeResults,
} from "../public/assets/js/games/escape-boss/stats.js";

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

describe("役職ごとのベストスコア", () => {
  it("クリアした記録の最高スコアを、役職ごとに返す", () => {
    const best = bestScoresByRole([
      result({ roleId: "senpai", score: 900, playedAt: 5 }),
      result({ roleId: "senpai", score: 1500, playedAt: 4, jobId: "sales" }),
      result({ roleId: "senpai", score: 9999, status: "gameover", playedAt: 3 }),
      result({ roleId: "buchou", score: 2000, playedAt: 2 }),
    ]);
    assert.deepEqual(best, {
      senpai: { score: 1500, playedAt: 4, jobId: "sales" },
      buchou: { score: 2000, playedAt: 2, jobId: "engineer" },
    });
  });

  it("クリアがなければ空", () => {
    assert.deepEqual(bestScoresByRole([result({ status: "gameover" })]), {});
    assert.deepEqual(bestScoresByRole([]), {});
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
