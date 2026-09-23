// 復習リスト(直近のプレイでミスした語)のテスト(Phase 12 PR 2)。
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  REVIEW_LIMIT,
  REVIEW_PLAYS,
  buildReviewList,
  indexWords,
} from "../public/assets/js/games/escape-boss/review.js";
import { createEmptyData, normalizeData } from "../public/assets/js/games/escape-boss/storage.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const word = (id, japanese = id) => ({
  id,
  japanese,
  reading: "よみ",
  explanation: `${id}の説明。`,
});
const vocabulary = (jobId, count, start = 1) => ({
  job_id: jobId,
  items: Array.from({ length: count }, (_, i) =>
    word(`${jobId}-${String(start + i).padStart(3, "0")}`),
  ),
});
// results は、新しい順(先頭が、いちばん新しい)
const play = (playedAt, wordMisses) => ({ playedAt, wordMisses });

describe("語の対応(indexWords)", () => {
  it("語録から、id → { word, jobId } を作る。重複した id は、最初のものを使う", () => {
    const index = indexWords([
      vocabulary("a", 2),
      vocabulary("b", 1),
      { job_id: "c", items: [word("a-001", "別")] },
    ]);
    assert.equal(index.size, 3);
    assert.equal(index.get("a-001").jobId, "a");
    assert.equal(index.get("a-001").word.japanese, "a-001");
    assert.equal(index.get("b-001").jobId, "b");
  });

  it("items がない・null・空でも、落ちない", () => {
    assert.equal(indexWords([]).size, 0);
    assert.equal(indexWords([{ job_id: "x" }, null, { job_id: "y", items: [] }]).size, 0);
  });
});

describe("復習リスト(buildReviewList)", () => {
  const index = indexWords([vocabulary("a", 30)]);

  it("既定: 直近 20 プレイ・最大 20 語", () => {
    assert.equal(REVIEW_PLAYS, 20);
    assert.equal(REVIEW_LIMIT, 20);
  });

  it("ミスした語だけを、ミスの合計の多い順に並べる", () => {
    const list = buildReviewList(
      [play(300, { "a-001": 1, "a-002": 2 }), play(200, { "a-001": 2, "a-003": 1 }), play(100, {})],
      index,
    );
    assert.deepEqual(
      list.map((entry) => [entry.word.id, entry.misses]),
      [
        ["a-001", 3],
        ["a-002", 2],
        ["a-003", 1],
      ],
    );
  });

  it("同じミスの数なら、最近ミスした語が先。それも同じなら、id 順(毎回、同じ結果)", () => {
    const results = [
      play(300, { "a-005": 1 }),
      play(200, { "a-004": 1, "a-002": 1 }),
      play(100, { "a-001": 1 }),
    ];
    const ids = (list) => list.map((entry) => entry.word.id);
    assert.deepEqual(ids(buildReviewList(results, index)), ["a-005", "a-002", "a-004", "a-001"]);
    assert.deepEqual(ids(buildReviewList(results, index)), ids(buildReviewList(results, index)));
    assert.deepEqual(buildReviewList(results, index)[0].lastMissedAt, 300);
  });

  it("直近 20 プレイだけを見る(それより古いプレイの、ミスは、数えない)", () => {
    const results = Array.from({ length: 25 }, (_, i) =>
      play(1000 - i, i === 24 ? { "a-030": 9 } : i === 3 ? { "a-001": 1 } : {}),
    );
    const list = buildReviewList(results, index);
    assert.deepEqual(
      list.map((entry) => entry.word.id),
      ["a-001"],
    );
    // 21 番目のプレイ(添字 20)より後は、対象外。20 番目(添字 19)は、対象
    const edge = Array.from({ length: 21 }, (_, i) =>
      play(500 - i, i === 19 ? { "a-002": 1 } : i === 20 ? { "a-003": 1 } : {}),
    );
    assert.deepEqual(
      buildReviewList(edge, index).map((entry) => entry.word.id),
      ["a-002"],
    );
  });

  it("最大 20 語(ミスの多い順に、上位だけ)", () => {
    const misses = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`a-${String(i + 1).padStart(3, "0")}`, 30 - i]),
    );
    const list = buildReviewList([play(1, misses)], index);
    assert.equal(list.length, 20);
    assert.equal(list[0].word.id, "a-001");
    assert.equal(list[19].word.id, "a-020");
    assert.equal(buildReviewList([play(1, misses)], index, { limit: 3 }).length, 3);
    assert.equal(
      buildReviewList([play(1, misses), play(0, { "a-030": 99 })], index, { plays: 1 }).length,
      20,
    );
  });

  it("語録にない語(消えた語・別のデータ)は、無視する", () => {
    const list = buildReviewList(
      [play(1, { "gone-001": 5, "a-001": 1, __proto__: 3, constructor: 2 })],
      index,
    );
    assert.deepEqual(
      list.map((entry) => entry.word.id),
      ["a-001"],
    );
  });

  it("ミスの数が、0・負・小数・数でない・NaN のものは、無視する", () => {
    const list = buildReviewList(
      [
        play(1, {
          "a-001": 0,
          "a-002": -1,
          "a-003": 1.5,
          "a-004": "x",
          "a-005": NaN,
          "a-006": null,
          "a-007": "2",
        }),
      ],
      index,
    );
    assert.deepEqual(
      list.map((entry) => [entry.word.id, entry.misses]),
      [["a-007", 2]],
    );
  });

  it("wordMisses がない・null のプレイ(以前の版の記録)、results が空・undefined でも、落ちない", () => {
    assert.deepEqual(
      buildReviewList([{ playedAt: 1 }, { playedAt: 2, wordMisses: null }, null, undefined], index),
      [],
    );
    assert.deepEqual(buildReviewList([], index), []);
    assert.deepEqual(buildReviewList(undefined, index), []);
  });

  it("職種をまたいで、集める。語には、職種の id がつく", () => {
    const both = indexWords([vocabulary("a", 2), vocabulary("b", 2)]);
    const list = buildReviewList([play(1, { "a-001": 1, "b-002": 2 })], both);
    assert.deepEqual(
      list.map((entry) => [entry.word.id, entry.jobId]),
      [
        ["b-002", "b"],
        ["a-001", "a"],
      ],
    );
  });

  it("入力を書き換えない", () => {
    const results = [play(2, { "a-001": 1 }), play(1, { "a-001": 2 })];
    const before = JSON.stringify(results);
    buildReviewList(results, index);
    assert.equal(JSON.stringify(results), before);
  });

  it("用語確認の結果は、含まれない(保存されないので、元データがない)", () => {
    // 記録のプレイ結果だけを使う。用語確認は、記録を保存しない(tests/game-page.test.js が検査)
    assert.deepEqual(buildReviewList([], index), []);
  });
});

describe("保存された記録から(実際の形)", () => {
  const vocabularies = readdirSync(`${root}public/data/vocabulary/`).map((file) =>
    JSON.parse(readFileSync(`${root}public/data/vocabulary/${file}`, "utf8")),
  );
  const index = indexWords(vocabularies);

  it("実際の語録: 全職種の全語が、対応にある(96 語以上)", () => {
    assert.ok(index.size >= 96);
    for (const vocab of vocabularies)
      for (const item of vocab.items) assert.ok(index.has(item.id), item.id);
  });

  it("保存の形(normalizeData を通したもの)から、作れる。記録の版は、4(以前の版の結果も、読める)", () => {
    const data = createEmptyData();
    assert.equal(data.version, 4);
    const raw = {
      ...data,
      results: [
        {
          playedAt: 200,
          jobId: "engineer",
          roleId: "senpai",
          status: "cleared",
          score: 1,
          correct: 14,
          miss: 3,
          hits: 100,
          elapsed: 60,
          distance: 10,
          wordMisses: { "engineer-004": 2, "engineer-001": 1 },
        },
        {
          playedAt: 100,
          jobId: "sales",
          roleId: "senpai",
          status: "gameover",
          score: 1,
          correct: 3,
          miss: 5,
          hits: 30,
          elapsed: 20,
          distance: 0,
          wordMisses: { "sales-001": 5 },
        },
      ],
    };
    const normalized = normalizeData(raw);
    const list = buildReviewList(normalized.results, index);
    assert.deepEqual(
      list.map((entry) => [entry.word.id, entry.jobId, entry.misses]),
      [
        ["sales-001", "sales", 5],
        ["engineer-004", "engineer", 2],
        ["engineer-001", "engineer", 1],
      ],
    );
  });

  it("以前の版(1)の記録は、wordMisses がなく、空のリストになる(落ちない)", () => {
    const v1 = normalizeData({
      version: 1,
      profile: { nickname: "a", titleId: "newbie" },
      results: [
        {
          playedAt: 1,
          jobId: "engineer",
          roleId: "senpai",
          status: "cleared",
          score: 1,
          correct: 1,
          miss: 0,
          hits: 1,
          elapsed: 1,
          distance: 1,
        },
      ],
      rankings: {},
      achievements: {},
      progress: { totalClears: 0, totalWords: 0, clears: {}, clearedJobs: {} },
    });
    assert.deepEqual(buildReviewList(v1.results, index), []);
  });
});
