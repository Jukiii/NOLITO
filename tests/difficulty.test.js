// 難易度の ID(Phase 18 PR 1)のテスト: difficulty.js(DOM・保存に触れない)。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_IDS,
  isDifficulty,
} from "../public/assets/js/games/escape-boss/difficulty.js";

describe("難易度の ID", () => {
  it("3 つ(easy・normal・hard)。既定は normal", () => {
    assert.deepEqual([...DIFFICULTY_IDS], ["easy", "normal", "hard"]);
    assert.equal(DEFAULT_DIFFICULTY, "normal");
    assert.ok(DIFFICULTY_IDS.includes(DEFAULT_DIFFICULTY));
    assert.ok(Object.isFrozen(DIFFICULTY_IDS));
  });

  it("isDifficulty: 決まった 3 つだけ true", () => {
    for (const id of DIFFICULTY_IDS) assert.equal(isDifficulty(id), true, id);
    for (const bad of [
      "EASY",
      "Normal",
      "extreme",
      "",
      "__proto__",
      "constructor",
      5,
      null,
      undefined,
      [],
      {},
      true,
    ]) {
      assert.equal(isDifficulty(bad), false, String(bad));
    }
  });
});

describe("difficulty.js は、DOM・保存に触れない", () => {
  it("document・window・storage を、使わない", () => {
    const source = readFileSync(
      new URL("../public/assets/js/games/escape-boss/difficulty.js", import.meta.url),
      "utf8",
    );
    assert.ok(!/\b(document|window|localStorage|sessionStorage|fetch)\b/.test(source));
  });
});
