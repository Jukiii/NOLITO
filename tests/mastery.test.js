// 職種別の熟練度(Phase 18 PR 1)のテスト: mastery.js(DOM・保存・時計に触れない純粋な計算)。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  MASTERY_RANKS,
  jobMasteries,
  masteryOf,
} from "../public/assets/js/games/escape-boss/mastery.js";

describe("MASTERY_RANKS(段階の一覧)", () => {
  it("6 段階(見習い → … → マスター)。語数・クリア数は、段階が上がるほど厳しい", () => {
    assert.equal(MASTERY_RANKS.length, 6);
    assert.equal(MASTERY_RANKS[0].name, "見習い");
    assert.equal(MASTERY_RANKS.at(-1).name, "マスター");
    for (let i = 1; i < MASTERY_RANKS.length; i += 1) {
      assert.ok(MASTERY_RANKS[i].words > MASTERY_RANKS[i - 1].words, `words ${i}`);
      assert.ok(MASTERY_RANKS[i].clears >= MASTERY_RANKS[i - 1].clears, `clears ${i}`);
    }
    assert.deepEqual(
      MASTERY_RANKS.map((r) => r.rank),
      [0, 1, 2, 3, 4, 5],
    );
  });
});

describe("masteryOf(1 つの職種の熟練度)", () => {
  it("記録がなければ、見習い(rank 0)。次は初級", () => {
    const m = masteryOf(undefined);
    assert.equal(m.rank, 0);
    assert.equal(m.name, "見習い");
    assert.equal(m.words, 0);
    assert.equal(m.next.name, "初級");
  });

  it("語数だけ満たしていても、クリア数が足りなければ、上がらない(両方が条件)", () => {
    const m = masteryOf({ words: 200, clears: 0, plays: 5, hits: 100, miss: 10 });
    assert.equal(
      m.rank,
      1,
      "初級(30 語・0 クリア)は満たすが、中級(100 語・1 クリア)は、クリアが足りない",
    );
  });

  it("ちょうど境目(語数・クリア数とも一致)で、その段階になる", () => {
    const m = masteryOf({ words: 100, clears: 1, plays: 3, hits: 0, miss: 0 });
    assert.equal(m.rank, 2, "中級");
  });

  it("最高段階(マスター)を超えても、rank 5 のまま。next は null、ratio は 1", () => {
    const m = masteryOf({ words: 5000, clears: 30, plays: 100, hits: 0, miss: 0 });
    assert.equal(m.rank, 5);
    assert.equal(m.name, "マスター");
    assert.equal(m.next, null);
    assert.equal(m.ratio, 1);
  });

  it("次の段階までの、残りの語数・クリア数(wordsLeft・clearsLeft)", () => {
    const m = masteryOf({ words: 50, clears: 0, plays: 2, hits: 0, miss: 0 });
    assert.equal(m.next.wordsLeft, 100 - 50);
    assert.equal(m.next.clearsLeft, 1 - 0);
  });

  it("正確率: 打っていれば hits/(hits+miss)、1 回も打っていなければ null", () => {
    assert.equal(masteryOf({ hits: 90, miss: 10, words: 0, clears: 0, plays: 0 }).accuracy, 0.9);
    assert.equal(masteryOf({ hits: 0, miss: 0, words: 0, clears: 0, plays: 0 }).accuracy, null);
    assert.equal(masteryOf(undefined).accuracy, null);
  });

  it("ratio(次の段階までの、語数の割合)は 0〜1", () => {
    assert.equal(masteryOf({ words: 0, clears: 0 }).ratio, 0);
    assert.equal(masteryOf({ words: 15, clears: 0 }).ratio, 0.5);
    assert.ok(masteryOf({ words: 29, clears: 0 }).ratio < 1);
  });

  it("不正な値(負・数でない・文字列)は、0 として扱う(落ちない)", () => {
    for (const bad of [null, undefined, "x", 5, [], true]) {
      const m = masteryOf(bad);
      assert.equal(m.rank, 0, String(bad));
      assert.equal(m.words, 0);
      assert.equal(m.plays, 0);
    }
    const m = masteryOf({ words: -5, clears: NaN, plays: "x", hits: -1, miss: Infinity });
    assert.equal(m.words, 0);
    assert.equal(m.clears, 0);
    assert.equal(m.plays, 0);
  });

  it("小数は切り捨てる", () => {
    assert.equal(masteryOf({ words: 30.9, clears: 0 }).words, 30);
  });
});

describe("jobMasteries(職種の並びの順に返す)", () => {
  it("progress.jobs にない職種は、見習いになる。順番は jobIds のとおり", () => {
    const jobIds = ["engineer", "sales", "office"];
    const result = jobMasteries({ sales: { words: 100, clears: 1 } }, jobIds);
    assert.deepEqual(
      result.map((r) => r.id),
      jobIds,
    );
    assert.equal(result[0].rank, 0);
    assert.equal(result[1].rank, 2);
    assert.equal(result[2].rank, 0);
  });

  it("progressJobs が、null・undefined でも、落ちない", () => {
    const result = jobMasteries(undefined, ["engineer"]);
    assert.equal(result[0].rank, 0);
    assert.deepEqual(jobMasteries(null, []), []);
  });

  it("継承された職種(__proto__ など)は、数えない", () => {
    const jobs = Object.create({ engineer: { words: 9999, clears: 99 } });
    const result = jobMasteries(jobs, ["engineer"]);
    assert.equal(result[0].rank, 0);
  });
});

describe("mastery.js は、DOM・保存・時計に触れない", () => {
  it("document・window・storage・Date・performance を、使わない", () => {
    const source = readFileSync(
      new URL("../public/assets/js/games/escape-boss/mastery.js", import.meta.url),
      "utf8",
    );
    assert.ok(
      !/\b(document|window|localStorage|sessionStorage|Date|performance|fetch)\b/.test(source),
    );
  });
});
