import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ACHIEVEMENT_KINDS } from "../public/assets/js/games/escape-boss/achievements.js";

const publicUrl = (path) => new URL(`../public/${path}`, import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(publicUrl(`data/${path}`)));

const roles = readJson("roles.json");
const config = readJson("achievements.json");
const roleIds = roles.map((role) => role.id);

describe("役職データ", () => {
  it("先輩・係長・部長・社長・会長の順に5役職", () => {
    assert.deepEqual(roleIds, ["senpai", "kakaricho", "buchou", "shachou", "kaicho"]);
    for (const role of roles) {
      assert.ok(role.name && role.vehicle, role.id);
    }
  });

  it("役職が進むほど難しくなる(初期距離は減り、追跡は速く、倍率は上がる)", () => {
    for (let i = 1; i < roles.length; i++) {
      const [prev, next] = [roles[i - 1], roles[i]];
      assert.ok(next.stage.initial_distance <= prev.stage.initial_distance, `${next.id} 初期距離`);
      assert.ok(next.stage.drain_per_second > prev.stage.drain_per_second, `${next.id} 減少速度`);
      assert.ok(next.stage.miss_penalty >= prev.stage.miss_penalty, `${next.id} ミス`);
      assert.ok(next.stage.goal_words >= prev.stage.goal_words, `${next.id} 語数`);
      assert.ok(next.score_multiplier > prev.score_multiplier, `${next.id} 倍率`);
    }
  });

  it("目標語数は、職種ごとの語数を超えない(重複なしで出題できる)", () => {
    const smallest = Math.min(
      ...readJson("jobs.json").map((job) => readJson(`vocabulary/${job.id}.json`).items.length),
    );
    for (const role of roles) assert.ok(role.stage.goal_words <= smallest, role.id);
  });

  it("目標語数は、1プレイが1〜3分に収まる範囲(12〜20語。ふつうの打鍵速度で約1分)", () => {
    for (const role of roles) {
      assert.ok(role.stage.goal_words >= 12 && role.stage.goal_words <= 20, role.id);
    }
  });

  it("画像ファイルが存在する", () => {
    for (const role of roles) {
      assert.match(role.image, /^\/assets\/img\/escape-boss\/[a-z]+\.svg$/, role.id);
      assert.ok(existsSync(publicUrl(role.image.slice(1))), role.image);
    }
    assert.ok(existsSync(publicUrl("assets/img/escape-boss/player.svg")));
  });

  it("解放条件があるのは会長だけで、参照する役職が存在し、会長自身は含まない", () => {
    for (const role of roles) {
      if (role.id !== "kaicho") assert.equal(role.unlock, undefined, role.id);
    }
    const { unlock } = roles.find((role) => role.id === "kaicho");
    assert.equal(unlock.type, "clear_roles");
    assert.ok(unlock.roles.length > 0 && unlock.roles.every((id) => roleIds.includes(id)));
    assert.ok(!unlock.roles.includes("kaicho"));
    assert.ok(unlock.hint.length > 0);
  });

  it("語録のすべての語が、全役職の対象になっている", () => {
    for (const job of readJson("jobs.json")) {
      const { items } = readJson(`vocabulary/${job.id}.json`);
      for (const item of items) {
        for (const id of roleIds) assert.ok(item.roles.includes(id), `${item.id}: ${id}`);
      }
    }
  });
});

describe("実績データ", () => {
  const { achievements } = config;

  it("既定の称号と、16個の実績がある(うち4個は、Phase 18 PR 3 の隠し実績)", () => {
    assert.deepEqual(config.default_title, { id: "newbie", name: "新入社員" });
    assert.equal(achievements.length, 16);
    assert.equal(achievements.filter((a) => a.hidden === true).length, 4);
  });

  it("id・名前・称号名が重複せず、必須の項目がある", () => {
    const ids = achievements.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(!ids.includes(config.default_title.id));
    const names = achievements.map((a) => a.name);
    assert.equal(new Set(names).size, names.length);
    const titles = achievements.filter((a) => a.title).map((a) => a.title);
    assert.equal(new Set([...titles, config.default_title.name]).size, titles.length + 1);
    for (const a of achievements) {
      assert.match(a.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, a.id);
      assert.ok(a.name && a.description && a.kind, a.id);
      assert.equal(typeof a.params, "object", a.id);
      if (a.hidden !== undefined) assert.equal(typeof a.hidden, "boolean", a.id);
    }
  });

  it("条件の種類が判定でき、パラメータが正しい", () => {
    for (const a of achievements) {
      assert.ok(ACHIEVEMENT_KINDS.includes(a.kind), `${a.id}: ${a.kind}`);
      if (a.kind === "role_clear") assert.ok(roleIds.includes(a.params.role), a.id);
      if (a.kind === "all_roles_clear") {
        assert.ok(
          a.params.roles.every((id) => roleIds.includes(id)),
          a.id,
        );
      }
      if (a.kind === "total_clears" || a.kind === "total_words") {
        assert.ok(Number.isInteger(a.params.count) && a.params.count > 0, a.id);
      }
      if (a.kind === "close_call") assert.ok(a.params.max_distance > 0, a.id);
      if (a.kind === "fast_clear") assert.ok(a.params.min_cps > 0, a.id);
      if (a.kind === "difficulty_clear") {
        assert.ok(["easy", "normal", "hard"].includes(a.params.difficulty), a.id);
      }
      if (a.kind === "all_roles_clear_difficulty") {
        assert.ok(
          a.params.roles.every((id) => roleIds.includes(id)),
          a.id,
        );
        assert.ok(["easy", "normal", "hard"].includes(a.params.difficulty), a.id);
      }
      if (a.kind === "best_streak") {
        assert.ok(Number.isInteger(a.params.count) && a.params.count > 0, a.id);
      }
      if (a.kind === "job_mastery") {
        assert.ok(
          Number.isInteger(a.params.rank) && a.params.rank >= 0 && a.params.rank <= 5,
          a.id,
        );
      }
    }
  });

  it("会長の解放条件と、「裏ボス出現」の条件が一致している", () => {
    const { unlock } = roles.find((role) => role.id === "kaicho");
    const achievement = achievements.find((a) => a.kind === "all_roles_clear");
    assert.deepEqual([...achievement.params.roles].sort(), [...unlock.roles].sort());
  });

  it("全役職のクリアに、それぞれ実績がある", () => {
    for (const id of roleIds) {
      assert.ok(
        achievements.some((a) => a.kind === "role_clear" && a.params.role === id),
        id,
      );
    }
  });
});
