// 準備の画面のキャラクターのつぶやき(Issue #173)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { isValidLine } from "../public/assets/js/games/escape-boss/lines.js";
import { READY_LINES, pickReadyLine } from "../public/assets/js/games/escape-boss/ready.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

describe("準備の画面のつぶやき", () => {
  it("どれも、セリフの決め(20 字まで・制御文字なし)に合い、重複しない", () => {
    assert.ok(READY_LINES.length >= 5);
    for (const line of READY_LINES) assert.ok(isValidLine(line), line);
    assert.equal(new Set(READY_LINES).size, READY_LINES.length);
  });

  it("乱数の端でも、範囲の中の言葉を選ぶ", () => {
    for (const value of [0, 0.5, 0.999999]) {
      assert.ok(READY_LINES.includes(pickReadyLine(() => value)));
    }
  });

  it("直前と同じ言葉は、続けない", () => {
    for (const previous of READY_LINES) {
      for (const value of [0, 0.3, 0.7, 0.999999]) {
        assert.notEqual(
          pickReadyLine(() => value, previous),
          previous,
        );
      }
    }
  });
});

describe("配線: 準備の枠に、キャラクターと吹き出しがある", () => {
  const html = read("public/games/escape-boss/index.html");
  const view = read("public/assets/js/games/escape-boss/view.js");
  const main = read("public/assets/js/games/escape-boss/main.js");

  it("飾り(aria-hidden)で、絵は alt が空・player.svg を使う", () => {
    assert.match(
      html,
      /<div class="game-ready__talk" aria-hidden="true">[\s\S]*?alt=""[\s\S]*?player\.svg[\s\S]*?data-ready-line/,
    );
  });

  it("つぶやきは textContent で入れ、準備に入るたびに選び直す", () => {
    assert.match(view, /\$\("\[data-ready-line\]"\)\.textContent = line;/);
    assert.match(main, /view\.showReady\(lastReadyLine\);/);
  });
});
