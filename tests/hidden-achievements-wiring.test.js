// 隠し実績(Phase 18 PR 3)の、view.js のつなぎのテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const view = read("public/assets/js/games/escape-boss/view.js");

describe("view.js: 隠し実績は、解放するまで、名前・説明・称号を隠す", () => {
  it("achievementItem: hidden かつ 未解放のときだけ、隠す(masked)", () => {
    const fn = view.slice(
      view.indexOf("function achievementItem"),
      view.indexOf("// 今回のミス分析"),
    );
    assert.match(fn, /const masked = Boolean\(definition\.hidden\) && !unlocked;/);
    assert.match(fn, /masked \? HIDDEN_NAME : definition\.name/);
    assert.match(fn, /masked \? HIDDEN_TEXT : definition\.description/);
    // 称号(title)も、隠している間は出さない
    assert.match(fn, /!masked && definition\.title/);
  });

  it("結果画面の「新しい実績」は、常に unlockedAt(Date.now())つきで描画する(解放の瞬間は、必ず見える)", () => {
    assert.match(
      view,
      /newAchievements\.map\(\(definition\) => achievementItem\(definition, Date\.now\(\)\)\)/,
    );
  });

  it("文字は textContent 相当(el())だけで入れる(innerHTML を使わない)", () => {
    const fn = view.slice(
      view.indexOf("function achievementItem"),
      view.indexOf("// 今回のミス分析"),
    );
    assert.ok(!/innerHTML/.test(fn));
  });
});
