// 低性能端末向け設定「グラフィックを抑える」(Phase 22 PR3)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
} from "../public/assets/js/games/escape-boss/settings.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

describe("settings.js: simpleGraphics(既定オフ。true だけがオン)", () => {
  it("既定は false", () => {
    assert.equal(DEFAULT_SETTINGS.simpleGraphics, false);
  });

  it("true だけを、オンとして受け付ける。ほかは既定(false)に戻す", () => {
    assert.equal(normalizeSettings({ simpleGraphics: true }).simpleGraphics, true);
    for (const bad of ["true", 1, null, undefined, [], {}]) {
      assert.equal(normalizeSettings({ simpleGraphics: bad }).simpleGraphics, false, String(bad));
    }
  });

  it("ほかの設定(showExplanation等)と、独立している", () => {
    const value = normalizeSettings({ showExplanation: true, simpleGraphics: true });
    assert.equal(value.showExplanation, true);
    assert.equal(value.simpleGraphics, true);
  });
});

describe("画面(HTML): 「グラフィックを抑える」のチェックボックスがある", () => {
  const html = read("public/games/escape-boss/index.html");

  it("data-simple-graphics のチェックボックスと、対応するラベルがある", () => {
    assert.match(html, /<input type="checkbox" id="simple-graphics" data-simple-graphics \/>/);
    assert.match(html, /<label for="simple-graphics">グラフィックを抑える/);
  });

  it("「動きを減らす」設定(サイト全体。Phase21)とは別であることを、補足文で説明している", () => {
    const start = html.indexOf('id="simple-graphics-hint"');
    const hint = html.slice(start, html.indexOf("</p>", start));
    assert.match(hint, /動きを減らす/);
  });

  it("用語確認では隠す、既存の枠組み(data-graphics-option)を使う", () => {
    assert.match(html, /data-graphics-option/);
  });
});

describe("view.js: チェックボックスの配線", () => {
  const view = read("public/assets/js/games/escape-boss/view.js");

  it("bind() は onGraphicsChange を受け取り、change で呼ぶ", () => {
    assert.match(view, /onGraphicsChange,/);
    assert.match(
      view,
      /\$\("\[data-simple-graphics\]"\)\.addEventListener\("change", \(event\) =>\s*onGraphicsChange\(event\.target\.checked\),\s*\);/,
    );
  });

  it("setGraphicsSetting は、保存された設定を、チェックボックスへ反映する", () => {
    const fn = view.slice(
      view.indexOf("setGraphicsSetting(checked)"),
      view.indexOf("setGraphicsSetting(checked)") + 150,
    );
    assert.match(fn, /\$\("\[data-simple-graphics\]"\)\.checked = checked;/);
  });

  it("applyMode: 用語確認では、グラフィックの設定欄を隠す(場面がそもそもないため)", () => {
    const fn = view.slice(view.indexOf("function applyMode"), view.indexOf("function option"));
    assert.match(fn, /\$\("\[data-graphics-option\]"\)\.hidden = check;/);
  });

  it("showPlay: simpleGraphics が true のとき、場面の背景SVGを読み込まず、scene.dataset.simpleGraphicsを付ける", () => {
    const fn = view.slice(view.indexOf("showPlay({"), view.indexOf("renderWord(word, matcher)"));
    assert.match(fn, /simpleGraphics = false/);
    assert.match(fn, /scene\.dataset\.simpleGraphics = simpleGraphics \? "true" : "";/);
    assert.match(fn, /const background = !simpleGraphics && backgroundOf\(job\);/);
  });
});

describe("main.js: 設定の読み込み・保存・showPlayへの受け渡し", () => {
  const main = read("public/assets/js/games/escape-boss/main.js");

  it("初期化時に、保存されている設定を反映する", () => {
    assert.match(main, /view\.setGraphicsSetting\(settings\.simpleGraphics\);/);
  });

  it("変更されたら、保存する", () => {
    assert.match(
      main,
      /onGraphicsChange: \(checked\) => \{\s*settings = \{ \.\.\.settings, simpleGraphics: checked \};\s*saveSettings\(backend, settings\);\s*\},/,
    );
  });

  it("連続タイピングの開始で、showPlay に simpleGraphics を渡す(用語確認には渡さない=場面がないため)", () => {
    const chaseCall = main.slice(main.indexOf('view.showPlay({\n    mode: "chase"'));
    const block = chaseCall.slice(0, chaseCall.indexOf("});"));
    assert.match(block, /simpleGraphics: settings\.simpleGraphics,/);
    assert.match(
      main,
      /view\.showPlay\(\{ mode: "check", jobName: job\.name, goal: words\.length \}\);/,
    );
  });
});

describe("CSS: グラフィックを抑える設定で、場面の紙吹雪・輝きを消す", () => {
  const css = read("public/assets/css/game.css");

  it(".scene[data-simple-graphics] で、紙吹雪(confetti)・輝き(glow)を display: none にする", () => {
    assert.match(css, /\.scene\[data-simple-graphics\] \.scene__confetti \{\s*display: none;\s*\}/);
    assert.match(
      css,
      /\.scene\[data-simple-graphics\] \.scene__glow \{\s*display: none !important;\s*\}/,
    );
  });

  it("紙吹雪の上書きは、役職別の演出(depart等)より前、輝きの上書きは!importantで確実に効く", () => {
    const confettiSimple = css.indexOf(".scene[data-simple-graphics] .scene__confetti");
    const confettiDepart = css.indexOf(
      '.scene[data-stage="clear"][data-outro="depart"] .scene__confetti',
    );
    assert.ok(confettiSimple > 0 && confettiDepart > 0 && confettiSimple < confettiDepart);
  });
});
