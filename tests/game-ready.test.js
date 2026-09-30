// ゲームの開始(準備 → スペースキーで開始)のテスト(Issue #140)。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { FULL_WIDTH_SPACE, readyAction } from "../public/assets/js/games/escape-boss/ready.js";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeChoice,
  normalizeSettings,
  saveSettings,
} from "../public/assets/js/games/escape-boss/settings.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

describe("readyAction: 準備の間の1文字", () => {
  it("半角スペースで、始まる", () => {
    assert.equal(readyAction(" "), "start");
  });

  it("全角スペース(U+3000)は、始めずに、全角だと知らせる", () => {
    assert.equal(FULL_WIDTH_SPACE.codePointAt(0), 0x3000);
    assert.equal(readyAction(FULL_WIDTH_SPACE), "fullwidth");
  });

  it("それ以外の文字・Enter・タブは、何もしない", () => {
    for (const char of ["a", "A", "あ", "\n", "\t", "", "0"]) {
      assert.equal(readyAction(char), "ignore", JSON.stringify(char));
    }
  });
});

describe("設定: 前回の選択(lastChoice)の引き継ぎ", () => {
  const fakeBackend = () => {
    const map = new Map();
    return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  };

  it("既定は、すべて空(選んでいない)", () => {
    assert.deepEqual(DEFAULT_SETTINGS.lastChoice, { mode: "", job: "", role: "", difficulty: "" });
  });

  it("保存して、読み込むと、同じ選択に戻る", () => {
    const backend = fakeBackend();
    const choice = { mode: "chase", job: "engineer", role: "senpai", difficulty: "hard" };
    saveSettings(backend, normalizeSettings({ ...DEFAULT_SETTINGS, lastChoice: choice }));
    assert.deepEqual(loadSettings(backend).lastChoice, choice);
  });

  it("壊れた値(型違い・変な文字・長すぎる)は、その項目だけ空に戻す", () => {
    assert.deepEqual(
      normalizeChoice({ mode: 1, job: "<script>", role: "a".repeat(31), difficulty: "normal" }),
      { mode: "", job: "", role: "", difficulty: "normal" },
    );
    for (const bad of [null, "x", 3, [], undefined]) {
      assert.deepEqual(normalizeChoice(bad), { mode: "", job: "", role: "", difficulty: "" });
    }
  });
});

describe("配線: 準備の間は、スペースキーを押すまで、始まらない", () => {
  const main = read("public/assets/js/games/escape-boss/main.js");
  const view = read("public/assets/js/games/escape-boss/view.js");
  const html = read("public/games/escape-boss/index.html");

  it("beginGame は、開始の演出ではなく、準備(ready)で終わる", () => {
    const start = main.indexOf("function beginGame") >= 0 ? main.indexOf("function beginGame") : 0;
    const fn = main.slice(start, main.indexOf("function leaveReady"));
    assert.match(fn, /session\.phase = "ready";\s*view\.showReady\(\);/);
    assert.doesNotMatch(fn.slice(fn.lastIndexOf("view.renderStats")), /beginIntro\(\)/);
  });

  it("leaveReady だけが、準備から開始の演出(beginIntro)へ進む", () => {
    assert.match(
      main,
      /function leaveReady\(\) \{\s*if \(session\?\.phase !== "ready"\) return;\s*view\.hideReady\(\);\s*session\.phase = "intro";[\s\S]*?beginIntro\(\);/,
    );
    assert.equal(main.match(/beginIntro\(\);/g).length, 1);
  });

  it("handleChar は、準備の間の入力を、ゲームの判定より先に扱う(ミスに数えない)", () => {
    const fn = main.slice(main.indexOf("function handleChar"));
    assert.ok(
      fn.indexOf('session?.phase === "ready"') < fn.indexOf('session.phase !== "play"'),
      "準備の分岐が、ゲームの判定より前にない",
    );
    assert.match(fn, /handleReadyChar\(char\);\s*return;/);
  });

  it("スタートのボタン(タップ)からも始められる", () => {
    assert.match(main, /onReadyStart: leaveReady/);
    assert.match(view, /\[data-ready-start\]/);
  });

  it("選択の引き継ぎ: 変えるたびに保存し、描画のときに渡す", () => {
    assert.match(main, /lastChoice: choice/);
    assert.match(main, /choice: settings\.lastChoice/);
    assert.match(view, /onChoiceChange/);
  });

  it("準備の部品は、追いかけ専用(data-chase-only)にしない(showPlay が隠す・出すため)", () => {
    const panel = html.slice(html.indexOf("data-ready "), html.indexOf("data-ready-start"));
    assert.ok(panel.length > 0);
    assert.doesNotMatch(panel, /data-chase-only/);
    assert.match(html, /data-ready-notice/);
    assert.match(html, /role="alert"/);
  });

  it("全角の知らせは、文字で示す(色だけに頼らない)", () => {
    assert.match(html, /全角のスペース/);
  });
});
