// 低性能端末向け設定「BGMを簡略化する」(Phase 23 PR3)のテスト。
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

describe("settings.js: simpleSound(既定オフ。true だけがオン)", () => {
  it("既定は false", () => {
    assert.equal(DEFAULT_SETTINGS.simpleSound, false);
  });

  it("true だけを、オンとして受け付ける。ほかは既定(false)に戻す", () => {
    assert.equal(normalizeSettings({ simpleSound: true }).simpleSound, true);
    for (const bad of ["true", 1, null, undefined, [], {}]) {
      assert.equal(normalizeSettings({ simpleSound: bad }).simpleSound, false, String(bad));
    }
  });

  it("ほかの設定(soundMode・volume・simpleGraphics等)と、独立している", () => {
    const value = normalizeSettings({
      soundMode: "all",
      volume: 80,
      simpleGraphics: true,
      simpleSound: true,
    });
    assert.equal(value.soundMode, "all");
    assert.equal(value.volume, 80);
    assert.equal(value.simpleGraphics, true);
    assert.equal(value.simpleSound, true);
  });
});

describe("画面(HTML): 「BGMを簡略化する」のチェックボックスがある", () => {
  const html = read("public/games/escape-boss/index.html");

  it("data-simple-sound のチェックボックスと、対応するラベルがある", () => {
    assert.match(html, /<input type="checkbox" id="simple-sound" data-simple-sound \/>/);
    assert.match(html, /<label for="simple-sound">BGMを簡略化する/);
  });

  it("既存の音の設定欄(data-sound-option)の中にある。用語確認でも隠さない(音の設定は、いつも表示されるため)", () => {
    const soundOption = html.slice(
      html.indexOf("data-sound-option"),
      html.indexOf("data-sound-option") +
        html.slice(html.indexOf("data-sound-option")).indexOf("</div>\n            <button"),
    );
    assert.match(soundOption, /data-simple-sound/);
  });
});

describe("view.js: チェックボックスの配線", () => {
  const view = read("public/assets/js/games/escape-boss/view.js");

  it("bind() は onSimpleSoundChange を受け取り、change で呼ぶ", () => {
    assert.match(view, /onSimpleSoundChange,/);
    assert.match(
      view,
      /\$\("\[data-simple-sound\]"\)\.addEventListener\("change", \(event\) =>\s*onSimpleSoundChange\(event\.target\.checked\),\s*\);/,
    );
  });

  it("setSoundSettings は、保存された設定(simpleSound を含む)を、チェックボックスへ反映する", () => {
    const fn = view.slice(
      view.indexOf("setSoundSettings("),
      view.indexOf("setSoundSettings(") + 300,
    );
    assert.match(fn, /simpleSound/);
    assert.match(fn, /\$\("\[data-simple-sound\]"\)\.checked = simpleSound === true;/);
  });
});

describe("main.js: 設定の読み込み・保存・sound.configure への受け渡し", () => {
  const main = read("public/assets/js/games/escape-boss/main.js");

  it("applySound は、simpleSound を sound.configure の simple に渡す", () => {
    const fn = main.slice(main.indexOf("const applySound"), main.indexOf("const reducedMotion"));
    assert.match(fn, /simple: settings\.simpleSound,/);
    assert.match(fn, /view\.setSoundSettings\(settings\);/);
  });

  it("変更されたら、既存の changeSound(保存 + 反映)で処理する", () => {
    assert.match(
      main,
      /onSimpleSoundChange: \(checked\) => changeSound\(\{ simpleSound: checked \}\),/,
    );
  });
});
