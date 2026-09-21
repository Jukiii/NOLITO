// バランス(クリア率)の確認テスト(Phase 12 PR 3)。実際の語録・役職・エンジンで、打鍵のモデルを、
// 決まった乱数で何回も遊ばせ、決定ログ 0006・0022 の表から大きくずれていないことを確かめる。
// 語録・roles.json・距離の式を変えて、このテストが失敗したら、シミュレーションでバランスを見直す(0022)。
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

// 1 回のプレイ。語ごとに、打ち始めから打ち終わりまでの時間を、速さの加点に渡す(main.js と同じ考え方)
function play(role, typist, random) {
  const stage = role.stage;
  const job = jobs[Math.floor(random() * jobs.length)].id;
  const words = pickWords(vocabularies[job], role.id, stage.goal_words, random);
  let state = createGameState(stage);
  for (const word of words) {
    const length = canonicalLength.get(word.id);
    let seconds = typist.reaction;
    let typing = 0;
    for (let i = 0; i < length; i++) {
      seconds += 1 / typist.cps;
      if (i > 0) typing += 1 / typist.cps;
      if (random() < typist.missRate) {
        seconds += 0.4;
        if (i > 0) typing += 0.4;
        state = applyMiss(state, stage);
      }
    }
    state = tick(state, stage, seconds);
    if (state.status !== "playing") break;
    state = applyCorrect(state, stage, length, {
      difficulty: word.difficulty,
      seconds: typing,
      keystrokes: length,
    });
    if (state.status !== "playing") break;
  }
  return state;
}

const results = {};
for (const role of roles) {
  results[role.id] = {};
  for (const [name, typist] of Object.entries(TYPISTS)) {
    const random = seeded(21);
    let cleared = 0;
    let time = 0;
    for (let i = 0; i < TRIALS; i++) {
      const state = play(role, typist, random);
      if (state.status === "cleared") {
        cleared += 1;
        time += state.elapsed;
      }
    }
    results[role.id][name] = { rate: (cleared / TRIALS) * 100, time: cleared ? time / cleared : 0 };
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
});
