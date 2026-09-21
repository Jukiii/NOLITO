// 役職ごとの文字数(語の重み)(Phase 17 PR 1)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { pickWords } from "../public/assets/js/games/escape-boss/vocabulary.js";
import {
  WEIGHT_MAX,
  WEIGHT_MIN,
  mergeWeights,
  normalizeWordWeights,
  roleWordWeights,
} from "../public/assets/js/games/escape-boss/word-weights.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const roles = JSON.parse(read("public/data/roles.json"));
const jobs = JSON.parse(read("public/data/jobs.json"));
const vocab = Object.fromEntries(
  jobs.map((job) => [job.id, JSON.parse(read(`public/data/vocabulary/${job.id}.json`)).items]),
);

const seeded = (seed) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

describe("normalizeWordWeights", () => {
  it("難易度 1〜5 の、範囲内(0.1〜10)の重みだけを残す", () => {
    assert.equal(WEIGHT_MIN, 0.1);
    assert.equal(WEIGHT_MAX, 10);
    assert.deepEqual(normalizeWordWeights({ 1: 3, 2: 1.5, 3: 0.4, 4: 1, 5: 10 }), {
      1: 3,
      2: 1.5,
      3: 0.4,
      4: 1,
      5: 10,
    });
    assert.deepEqual(
      normalizeWordWeights({ 1: 0.09, 2: 10.01, 3: -1, 4: Number.NaN, 5: "2", 6: 3, x: 2, 0: 1 }),
      {},
    );
    assert.deepEqual(normalizeWordWeights({ 1: 0.1, 2: 10 }), { 1: 0.1, 2: 10 });
  });

  it("表でないもの・配列・null は、空。継承された項目は、数えない", () => {
    for (const bad of [null, undefined, 5, "1", [], [3, 3, 3]]) {
      assert.deepEqual(normalizeWordWeights(bad), {}, JSON.stringify(bad));
    }
    const inherited = Object.create({ 1: 3 });
    assert.deepEqual(normalizeWordWeights(inherited), {});
  });
});

describe("roleWordWeights(役職の重み)", () => {
  const items = [
    { id: "a", difficulty: 1 },
    { id: "b", difficulty: 2 },
    { id: "c", difficulty: 3 },
    { id: "d", difficulty: 4 },
    { id: "e" },
  ];

  it("語の難易度に対応する重みを、id ごとに返す。表にない難易度・難易度のない語は、入れない(1 として扱われる)", () => {
    const map = roleWordWeights(items, { word_weights: { 1: 3, 2: 2, 3: 0.5 } });
    assert.deepEqual(
      [...map],
      [
        ["a", 3],
        ["b", 2],
        ["c", 0.5],
      ],
    );
  });

  it("表がない・壊れている・stage がない場合は、空の Map", () => {
    for (const stage of [
      undefined,
      null,
      {},
      { word_weights: null },
      { word_weights: {} },
      { word_weights: { 1: 99 } },
    ]) {
      assert.equal(roleWordWeights(items, stage).size, 0, JSON.stringify(stage));
    }
    assert.equal(roleWordWeights([], { word_weights: { 1: 2 } }).size, 0);
    assert.equal(roleWordWeights([null, undefined], { word_weights: { 1: 2 } }).size, 0);
  });

  it("入力を書き換えない", () => {
    const stage = { word_weights: { 1: 3 } };
    const before = JSON.stringify({ stage, items });
    roleWordWeights(items, stage);
    assert.equal(JSON.stringify({ stage, items }), before);
  });
});

describe("mergeWeights(苦手な語の重みと、かけ合わせる)", () => {
  it("同じ語の重みを、かけ合わせる。片方にしかない語は、そのまま", () => {
    const merged = mergeWeights(
      new Map([
        ["a", 2],
        ["b", 3],
      ]),
      new Map([
        ["a", 1.5],
        ["c", 4],
      ]),
    );
    assert.deepEqual([...merged].sort(), [
      ["a", 3],
      ["b", 3],
      ["c", 4],
    ]);
  });

  it("null・空・Map でないものは、無視する。どれも使えなければ null(重みなし = ふつうのシャッフル)", () => {
    assert.equal(mergeWeights(), null);
    assert.equal(mergeWeights(null, new Map(), undefined, {}, []), null);
    assert.deepEqual([...mergeWeights(null, new Map([["a", 2]]), new Map())], [["a", 2]]);
  });

  it("0 以下・数でない重みは、捨てる。入力の Map を、書き換えない", () => {
    const first = new Map([
      ["a", 2],
      ["b", 0],
      ["c", -1],
      ["d", Number.NaN],
    ]);
    const merged = mergeWeights(first, new Map([["a", 2]]));
    assert.deepEqual([...merged], [["a", 4]]);
    assert.equal(first.size, 4);
    assert.equal(first.get("a"), 2);
  });
});

describe("出題への反映(実際の語録・役職)", () => {
  const meanDifficulty = (role, trials = 400) => {
    const random = seeded(7);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < trials; i++) {
      const items = vocab[jobs[i % jobs.length].id];
      const weights = mergeWeights(roleWordWeights(items, role.stage));
      for (const word of pickWords(items, role.id, role.stage.goal_words, random, { weights })) {
        sum += word.difficulty;
        count += 1;
      }
    }
    return sum / count;
  };

  it("役職が進むほど、出る語の平均の難易度(文字数)が、上がる", () => {
    const means = roles.map((role) => meanDifficulty(role));
    for (let i = 1; i < means.length; i++) {
      assert.ok(
        means[i] >= means[i - 1] + 0.08,
        `${roles[i].id}: ${means.map((m) => m.toFixed(2))}`,
      );
    }
    assert.ok(means[0] < 1.85 && means.at(-1) > 2.15);
  });

  it("語は削らない: どの役職・職種でも、目標語数を、重複なしで選べる。全語が、選ばれうる", () => {
    for (const role of roles) {
      const seen = new Set();
      for (const job of jobs) {
        const items = vocab[job.id];
        const random = seeded(3);
        for (let trial = 0; trial < 60; trial++) {
          const weights = mergeWeights(roleWordWeights(items, role.stage));
          const words = pickWords(items, role.id, role.stage.goal_words, random, { weights });
          assert.equal(words.length, role.stage.goal_words);
          assert.equal(
            new Set(words.map((word) => word.id)).size,
            words.length,
            `${role.id} ${job.id}`,
          );
          for (const word of words) seen.add(word.id);
        }
      }
      assert.equal(seen.size, 180, `${role.id}: 出る語 ${seen.size}`);
    }
  });

  it("重みなし(null)は、これまでと同じ(同じ乱数で、同じ語・同じ順)", () => {
    const items = vocab.engineer;
    const a = pickWords(items, "senpai", 14, seeded(5)).map((word) => word.id);
    const b = pickWords(items, "senpai", 14, seeded(5), { weights: mergeWeights() }).map(
      (word) => word.id,
    );
    assert.deepEqual(a, b);
  });

  it("苦手な語の重みとも、かけ合わせて働く(苦手な語は、役職の重みがあっても、出やすい)", () => {
    const items = vocab.engineer;
    const weak = items.find((item) => item.difficulty === 3);
    const role = roles.find((item) => item.id === "senpai"); // 長い語が出にくい
    let plain = 0;
    let boosted = 0;
    for (let trial = 0; trial < 500; trial++) {
      const roleOnly = mergeWeights(roleWordWeights(items, role.stage));
      const both = mergeWeights(roleWordWeights(items, role.stage), new Map([[weak.id, 4]]));
      if (
        pickWords(items, role.id, 14, seeded(trial + 1), { weights: roleOnly }).some(
          (w) => w.id === weak.id,
        )
      )
        plain += 1;
      if (
        pickWords(items, role.id, 14, seeded(trial + 1), { weights: both }).some(
          (w) => w.id === weak.id,
        )
      )
        boosted += 1;
    }
    assert.ok(boosted > plain, `${plain} → ${boosted}`);
  });
});

describe("word-weights.js は、DOM・保存・乱数に触れない", () => {
  it("document・window・storage・Math.random を、使わない", () => {
    const source = read("public/assets/js/games/escape-boss/word-weights.js");
    assert.ok(!/\b(document|window|localStorage|sessionStorage|fetch|Date)\b/.test(source));
    assert.ok(!/Math\.random/.test(source));
  });
});
