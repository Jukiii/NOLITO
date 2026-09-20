import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createMatcher } from "../public/assets/js/games/escape-boss/romaji.js";

const readJson = (path) =>
  JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url)));

const jobs = readJson("jobs.json");
const roles = readJson("roles.json");
const roleIds = new Set(roles.map((role) => role.id));

// docs/05_checklists/vocabulary-validation.md の機械的に確認できる項目
const DIFFICULTY_RANGE = [1, 5];
const REQUIRED_META = ["job_id", "job_name", "version", "updated_at", "items"];
const REQUIRED_ITEM = [
  "id",
  "japanese",
  "reading",
  "romaji",
  "category",
  "difficulty",
  "roles",
  "explanation",
  "related_terms",
  "learning_points",
  "weak_detection",
];

function typeAll(reading, text) {
  const matcher = createMatcher(reading);
  for (const char of text) if (matcher.input(char) === "miss") return "miss";
  return matcher.done ? "done" : "incomplete";
}

describe("jobs.json / roles.json", () => {
  it("職種は6種で、id と name を持ち、id が重複しない", () => {
    assert.equal(jobs.length, 6);
    for (const job of jobs) {
      assert.match(job.id, /^[a-z]+(-[a-z]+)*$/);
      assert.ok(job.name);
    }
    assert.equal(new Set(jobs.map((job) => job.id)).size, jobs.length);
  });

  it("役職の stage に必要な数値がそろっている", () => {
    for (const role of roles) {
      assert.ok(role.id && role.name);
      for (const key of [
        "max_distance",
        "initial_distance",
        "drain_per_second",
        "base_gain",
        "gain_per_char",
        "difficulty_gain",
        "speed_gain",
        "speed_min_cps",
        "speed_max_cps",
        "miss_penalty",
        "goal_words",
      ]) {
        assert.equal(typeof role.stage[key], "number", `${role.id}.${key}`);
        assert.ok(role.stage[key] > 0, `${role.id}.${key} は正の数`);
      }
      assert.ok(role.stage.initial_distance <= role.stage.max_distance);
      // 速さの加点は、min〜max の範囲で 0 から上限まで(min < max)
      assert.ok(role.stage.speed_min_cps < role.stage.speed_max_cps, `${role.id} 速さの範囲`);
      assert.ok(Number.isInteger(role.stage.goal_words));
    }
  });
});

for (const job of jobs) {
  describe(`語録 ${job.id}`, () => {
    const vocabulary = readJson(`vocabulary/${job.id}.json`);

    it("必須のメタ情報があり、職種と一致する", () => {
      for (const key of REQUIRED_META) assert.ok(key in vocabulary, key);
      assert.equal(vocabulary.job_id, job.id);
      assert.equal(vocabulary.job_name, job.name);
      assert.match(vocabulary.version, /^\d+\.\d+\.\d+$/);
      assert.match(vocabulary.updated_at, /^\d{4}-\d{2}-\d{2}$/);
    });

    it("各役職が出題する語数を満たす(重複なしで出題できる)", () => {
      for (const role of roles) {
        const count = vocabulary.items.filter((item) => item.roles.includes(role.id)).length;
        assert.ok(count >= role.stage.goal_words, `${role.id}: ${count}語`);
      }
    });

    it("項目の必須フィールドと形式", () => {
      for (const item of vocabulary.items) {
        for (const key of REQUIRED_ITEM) assert.ok(key in item, `${item.id}.${key}`);
        assert.match(item.id, new RegExp(`^${job.id}-\\d{3}$`), item.id);
        assert.ok(item.japanese.trim() && item.reading.trim(), item.id);
        assert.ok(item.explanation.trim(), item.id);
        assert.ok(item.category.trim(), item.id);
        assert.ok(Array.isArray(item.romaji) && item.romaji.length > 0, item.id);
        for (const candidate of item.romaji) assert.match(candidate, /^[a-z-]+$/, item.id);
        assert.ok(Number.isInteger(item.difficulty), item.id);
        assert.ok(
          item.difficulty >= DIFFICULTY_RANGE[0] && item.difficulty <= DIFFICULTY_RANGE[1],
          `${item.id} の難易度`,
        );
        assert.ok(item.roles.length > 0 && item.roles.every((r) => roleIds.has(r)), item.id);
        assert.equal(typeof item.weak_detection.enabled, "boolean", item.id);
      }
    });

    it("ID と日本語表記が重複しない", () => {
      const ids = vocabulary.items.map((item) => item.id);
      const words = vocabulary.items.map((item) => item.japanese);
      assert.equal(new Set(ids).size, ids.length);
      assert.equal(new Set(words).size, words.length);
    });

    it("読みがローマ字入力エンジンで入力でき、宣言したローマ字候補がすべて受理される", () => {
      for (const item of vocabulary.items) {
        assert.doesNotThrow(() => createMatcher(item.reading), item.id);
        for (const candidate of item.romaji) {
          assert.equal(typeAll(item.reading, candidate), "done", `${item.id}: ${candidate}`);
        }
      }
    });
  });
}

describe("語録全体", () => {
  it("職種をまたいで ID が重複しない", () => {
    const ids = jobs.flatMap((job) => readJson(`vocabulary/${job.id}.json`).items.map((i) => i.id));
    assert.equal(new Set(ids).size, ids.length);
  });
});
