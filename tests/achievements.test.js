import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ACHIEVEMENT_KINDS,
  availableTitles,
  evaluateAchievements,
  titleName,
} from "../public/assets/js/games/escape-boss/achievements.js";
import { recordResult } from "../public/assets/js/games/escape-boss/records.js";
import { createEmptyData } from "../public/assets/js/games/escape-boss/storage.js";

const readJson = (path) =>
  JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url)));
const config = readJson("achievements.json");
const jobIds = readJson("jobs.json").map((job) => job.id);

const result = (overrides = {}) => ({
  playedAt: 1000,
  jobId: "engineer",
  roleId: "senpai",
  status: "cleared",
  score: 1800,
  correct: 8,
  miss: 2,
  hits: 60,
  elapsed: 30,
  distance: 70,
  accuracy: 0.9,
  cps: 2,
  vocabularyVersion: "0.1.0",
  ...overrides,
});

// 結果を記録して実績を判定し、解放された実績を data にも反映する(main.js と同じ流れ)
function play(data, overrides) {
  const { data: recorded } = recordResult(data, result(overrides));
  const ids = evaluateAchievements({
    definitions: config.achievements,
    unlocked: recorded.achievements,
    progress: recorded.progress,
    result: recorded.results[0],
    jobIds,
  });
  const achievements = { ...recorded.achievements };
  for (const id of ids) achievements[id] = recorded.results[0].playedAt;
  return { data: { ...recorded, achievements }, ids };
}

describe("実績の判定", () => {
  it("役職のクリアで、その役職の実績が解放される", () => {
    const { ids } = play(createEmptyData(), { roleId: "senpai" });
    assert.deepEqual(ids, ["clear-senpai"]);
  });

  it("ゲームオーバーでは何も解放されない(累計語数の条件だけは進む)", () => {
    const { ids } = play(createEmptyData(), {
      status: "gameover",
      correct: 3,
      miss: 0,
      distance: 0,
    });
    assert.deepEqual(ids, []);
  });

  it("ノーミスでのクリア", () => {
    assert.ok(play(createEmptyData(), { miss: 0 }).ids.includes("perfect"));
    assert.ok(!play(createEmptyData(), { miss: 1 }).ids.includes("perfect"));
    assert.ok(!play(createEmptyData(), { miss: 0, status: "gameover" }).ids.includes("perfect"));
  });

  it("残り距離5m以下でのクリア(境界を含む)", () => {
    assert.ok(play(createEmptyData(), { distance: 5 }).ids.includes("close-call"));
    assert.ok(!play(createEmptyData(), { distance: 5.1 }).ids.includes("close-call"));
  });

  it("平均4打鍵/秒以上でのクリア(境界を含む)", () => {
    assert.ok(play(createEmptyData(), { cps: 4 }).ids.includes("lightning"));
    assert.ok(!play(createEmptyData(), { cps: 3.9 }).ids.includes("lightning"));
  });

  it("先輩〜社長をすべてクリアすると「裏ボス出現」", () => {
    let data = createEmptyData();
    const all = [];
    for (const roleId of ["senpai", "kakaricho", "buchou"]) {
      const out = play(data, { roleId });
      data = out.data;
      all.push(...out.ids);
    }
    assert.ok(!all.includes("unlock-kaicho"));
    const last = play(data, { roleId: "shachou" });
    assert.ok(last.ids.includes("unlock-kaicho"));
    assert.ok(last.ids.includes("clear-shachou"));
  });

  it("全職種でのクリア", () => {
    let data = createEmptyData();
    let last = [];
    for (const jobId of jobIds) {
      const out = play(data, { jobId });
      data = out.data;
      last = out.ids;
    }
    assert.ok(last.includes("all-jobs"));
  });

  it("累計クリア10回・累計100語", () => {
    let data = createEmptyData();
    let lastIds = [];
    for (let i = 0; i < 10; i++) {
      const out = play(data, { correct: 10, playedAt: i });
      data = out.data;
      lastIds = out.ids;
    }
    assert.ok(lastIds.includes("clears-10"));
    assert.ok(data.achievements["words-100"] !== undefined);
  });

  it("解放済みの実績は、もう一度返らない", () => {
    const first = play(createEmptyData(), { miss: 0 });
    const second = play(first.data, { miss: 0 });
    assert.ok(first.ids.includes("perfect"));
    assert.ok(!second.ids.includes("perfect"));
  });

  it("すべての実績の条件の種類が、判定できるもの", () => {
    for (const definition of config.achievements) {
      assert.ok(
        ACHIEVEMENT_KINDS.includes(definition.kind),
        `${definition.id}: ${definition.kind}`,
      );
    }
  });

  it("むずかしいでのクリア(隠し実績)", () => {
    assert.ok(play(createEmptyData(), { difficulty: "hard" }).ids.includes("hard-clear"));
    assert.ok(!play(createEmptyData(), { difficulty: "normal" }).ids.includes("hard-clear"));
    assert.ok(
      !play(createEmptyData(), { difficulty: "hard", status: "gameover" }).ids.includes(
        "hard-clear",
      ),
    );
  });

  it("先輩・係長・部長・社長を、すべてむずかしいでクリア(隠し実績)", () => {
    let data = createEmptyData();
    const all = [];
    for (const roleId of ["senpai", "kakaricho", "buchou"]) {
      const out = play(data, { roleId, difficulty: "hard" });
      data = out.data;
      all.push(...out.ids);
    }
    assert.ok(!all.includes("hard-master"));
    // ふつうでのクリアでは進まない
    const normal = play(data, { roleId: "shachou", difficulty: "normal" });
    assert.ok(!normal.ids.includes("hard-master"));
    const last = play(normal.data, { roleId: "shachou", difficulty: "hard" });
    assert.ok(last.ids.includes("hard-master"));
  });

  it("1プレイで10語以上ミスなく連続(隠し実績)", () => {
    assert.ok(play(createEmptyData(), { streak: 10 }).ids.includes("streak-10"));
    assert.ok(!play(createEmptyData(), { streak: 9 }).ids.includes("streak-10"));
    assert.ok(!play(createEmptyData(), { streak: undefined }).ids.includes("streak-10"));
  });

  it("いずれかの職種で熟練度マスターに到達(隠し実績)", () => {
    let data = createEmptyData();
    data.progress.jobs.engineer = { plays: 20, clears: 14, words: 1499, hits: 100, miss: 0 };
    let out = play(data, { jobId: "engineer", correct: 0, status: "gameover" });
    assert.ok(!out.ids.includes("job-master"));
    data = { ...out.data };
    data.progress.jobs.engineer = { plays: 20, clears: 15, words: 1500, hits: 100, miss: 0 };
    out = play(data, { jobId: "engineer", correct: 0, status: "gameover" });
    assert.ok(out.ids.includes("job-master"));
  });

  it("未知の種類の実績は解放されない", () => {
    const ids = evaluateAchievements({
      definitions: [{ id: "x", kind: "unknown", params: {} }],
      unlocked: {},
      progress: createEmptyData().progress,
      result: null,
      jobIds,
    });
    assert.deepEqual(ids, []);
  });
});

describe("称号", () => {
  it("最初は既定の称号だけ選べる", () => {
    assert.deepEqual(availableTitles(config, {}), [{ id: "newbie", name: "新入社員" }]);
  });

  it("解放済みの実績に付く称号が選べるようになる(称号のない実績は増えない)", () => {
    const titles = availableTitles(config, { "clear-senpai": 1, "close-call": 2 });
    assert.deepEqual(
      titles.map((t) => t.name),
      ["新入社員", "先輩超え"],
    );
  });

  it("称号の id から名前を引く。未知・未解放の id は既定の名前", () => {
    assert.equal(titleName(config, "clear-senpai"), "先輩超え");
    assert.equal(titleName(config, "newbie"), "新入社員");
    assert.equal(titleName(config, "close-call"), "新入社員");
    assert.equal(titleName(config, "nonexistent"), "新入社員");
  });
});

describe("隠し実績(hidden。Phase 18 PR 3)", () => {
  it("実際のデータ(achievements.json): hidden な実績は、称号(title)を持つか、なくてもよい", () => {
    const hidden = config.achievements.filter((a) => a.hidden === true);
    assert.ok(hidden.length >= 4, "隠し実績が、いくつか定義されていること");
  });

  it("achievements.js は、DOM・保存・時計に触れない(clearKey・masteryOf は、純粋な関数だけを使う)", () => {
    const source = readFileSync(
      new URL("../public/assets/js/games/escape-boss/achievements.js", import.meta.url),
      "utf8",
    );
    assert.ok(
      !/\b(document|window|localStorage|sessionStorage|Date|performance|fetch)\b/.test(source),
    );
  });
});
