// バランス(クリア率)の確認テスト(Phase 12 PR 3・Phase 17)。実際の語録・役職(文字数の重み・特殊ルールを含む)・エンジンで、
// 打鍵のモデルを、決まった乱数で何回も遊ばせ、決定ログ 0006・0022 の表から大きくずれていないことを確かめる。
// 語録・roles.json・距離の式・ルールを変えて、このテストが失敗したら、シミュレーションでバランスを見直す(0022・0033)。
// 打鍵ごとに時間を進める(ミスの時刻で、ルールの加速の間が決まるため)。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  applyCorrect,
  applyMiss,
  createGameState,
  tick,
} from "../public/assets/js/games/escape-boss/engine.js";
import { createMatcher } from "../public/assets/js/games/escape-boss/romaji.js";
import { pickWords } from "../public/assets/js/games/escape-boss/vocabulary.js";
import {
  mergeWeights,
  roleWordWeights,
} from "../public/assets/js/games/escape-boss/word-weights.js";

const readJson = (path) =>
  JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url), "utf8"));

const roles = readJson("roles.json");
const jobs = readJson("jobs.json");
const vocabularies = Object.fromEntries(
  jobs.map((job) => [job.id, readJson(`vocabulary/${job.id}.json`).items]),
);
const canonicalLength = new Map(
  Object.values(vocabularies)
    .flat()
    .map((item) => [item.id, createMatcher(item.reading).canonicalLength]),
);

// 打鍵のモデル(0006 と同じ): 1 秒あたりの打鍵数・語が出てから打ち始めるまで・ミスの率
const TYPISTS = {
  slow: { cps: 1.2, reaction: 1.4, missRate: 0.08 },
  normal: { cps: 2.5, reaction: 1.0, missRate: 0.08 },
  fast: { cps: 4, reaction: 0.8, missRate: 0.05 },
  master: { cps: 6, reaction: 0.6, missRate: 0.03 },
};
const TRIALS = 1000;

function seeded(seed) {
  let value = seed;
  return () => (value = (value * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

// 1 回のプレイ。打鍵ごとに時間を進め、ミスのあとは 0.4 秒の立て直し。語ごとに、打ち始めから打ち終わりまでの時間を、
// 速さの加点に渡す(main.js と同じ考え方)。出題は、役職の語の重み(stage.word_weights)を使う
function play(role, typist, random) {
  const stage = role.stage;
  const job = jobs[Math.floor(random() * jobs.length)].id;
  const items = vocabularies[job];
  const weights = mergeWeights(roleWordWeights(items, stage));
  const words = pickWords(items, role.id, stage.goal_words, random, { weights });
  let state = createGameState(stage);
  const alive = () => state.status === "playing";
  // 出題された全語の、平均の難易度(ゲームが途中で終わっても、同じ)
  const meanDifficulty = words.reduce((sum, word) => sum + word.difficulty, 0) / words.length;
  for (const word of words) {
    const length = canonicalLength.get(word.id);
    state = tick(state, stage, typist.reaction);
    if (!alive()) break;
    let typing = 0;
    for (let i = 0; i < length && alive(); i++) {
      state = tick(state, stage, 1 / typist.cps);
      if (i > 0) typing += 1 / typist.cps;
      if (!alive()) break;
      if (random() < typist.missRate) {
        state = applyMiss(state, stage);
        if (!alive()) break;
        state = tick(state, stage, 0.4);
        if (i > 0) typing += 0.4;
      }
    }
    if (!alive()) break;
    state = applyCorrect(state, stage, length, {
      difficulty: word.difficulty,
      seconds: typing,
      keystrokes: length,
    });
    if (!alive()) break;
  }
  return { state, meanDifficulty };
}

const results = {};
for (const role of roles) {
  results[role.id] = {};
  for (const [name, typist] of Object.entries(TYPISTS)) {
    const random = seeded(21);
    let cleared = 0;
    let time = 0;
    let difficulty = 0;
    for (let i = 0; i < TRIALS; i++) {
      const { state, meanDifficulty } = play(role, typist, random);
      difficulty += meanDifficulty;
      if (state.status === "cleared") {
        cleared += 1;
        time += state.elapsed;
      }
    }
    results[role.id][name] = {
      rate: (cleared / TRIALS) * 100,
      time: cleared ? time / cleared : 0,
      difficulty: difficulty / TRIALS,
    };
  }
}
const rate = (roleId, typist) => results[roleId][typist].rate;

describe("バランス(0006・0022 の表。各 1000 回のシミュレーション)", () => {
  it("先輩: 遅い人でも 8 割前後、ふつう以上は、ほぼ全員クリア", () => {
    assert.ok(rate("senpai", "slow") >= 75 && rate("senpai", "slow") <= 95, rate("senpai", "slow"));
    assert.ok(rate("senpai", "normal") >= 97);
  });

  it("係長・部長・社長: ふつうの人のクリア率が、段階的に下がる(約 89% → 67% → 50%)", () => {
    const [a, b, c] = ["kakaricho", "buchou", "shachou"].map((id) => rate(id, "normal"));
    assert.ok(a >= 80 && a <= 97, a);
    assert.ok(b >= 57 && b <= 77, b);
    assert.ok(c >= 40 && c <= 60, c);
    assert.ok(a > b && b > c);
  });

  it("係長以上は、遅い人には、クリアできない", () => {
    for (const id of ["kakaricho", "buchou", "shachou", "kaicho"]) {
      assert.ok(rate(id, "slow") <= 5, id);
    }
  });

  it("会長(裏ボス): ふつうの人にはクリアできず、速い人で 7 割前後、達人はクリアできる", () => {
    assert.ok(rate("kaicho", "normal") <= 5);
    assert.ok(rate("kaicho", "fast") >= 62 && rate("kaicho", "fast") <= 88, rate("kaicho", "fast"));
    assert.ok(rate("kaicho", "master") >= 95);
  });

  it("速く打つ人ほど、クリア率が下がらない(どの役職でも)", () => {
    const order = ["slow", "normal", "fast", "master"];
    for (const role of roles) {
      for (let i = 1; i < order.length; i++) {
        assert.ok(rate(role.id, order[i]) >= rate(role.id, order[i - 1]), `${role.id} ${order[i]}`);
      }
    }
  });

  it("達人は、すべての役職でクリアできる", () => {
    for (const role of roles) assert.ok(rate(role.id, "master") >= 95, role.id);
  });

  it("1 プレイは、1〜3 分に収まる(遅い人の先輩でも 3 分以内、達人は 1 分以内)", () => {
    assert.ok(results.senpai.slow.time <= 180, results.senpai.slow.time);
    assert.ok(results.senpai.normal.time >= 40 && results.senpai.normal.time <= 100);
    for (const role of roles) assert.ok(results[role.id].master.time <= 60, role.id);
  });

  it("役職が進むほど、出る語が、長く(難しく)なる(役職ごとの語の重み。0033)", () => {
    const order = ["senpai", "kakaricho", "buchou", "shachou", "kaicho"];
    for (let i = 1; i < order.length; i++) {
      const before = results[order[i - 1]].normal.difficulty;
      const after = results[order[i]].normal.difficulty;
      assert.ok(after >= before + 0.08, `${order[i]}: ${before.toFixed(2)} → ${after.toFixed(2)}`);
    }
  });

  it("特殊ルールは、クリア率を下げる(ルールを外すと、同じ役職のクリア率が上がる)。先輩には、ルールがない", () => {
    assert.deepEqual(roles.find((role) => role.id === "senpai").stage.rules, []);
    for (const id of ["kakaricho", "buchou", "shachou"]) {
      const role = roles.find((item) => item.id === id);
      const withoutRules = { ...role, stage: { ...role.stage, rules: [] } };
      const random = seeded(21);
      let cleared = 0;
      for (let i = 0; i < TRIALS; i++) {
        if (play(withoutRules, TYPISTS.normal, random).state.status === "cleared") cleared += 1;
      }
      assert.ok((cleared / TRIALS) * 100 > rate(id, "normal") + 5, id);
    }
  });
});
