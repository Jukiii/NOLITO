// 「セリフの表示」「演出を自動で飛ばす」設定(Phase 23 PR2)のテスト。
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

describe("settings.js: lineLevel(既定 normal)・skipStaging(既定オフ。true だけがオン)", () => {
  it("既定は、lineLevel: normal・skipStaging: false", () => {
    assert.equal(DEFAULT_SETTINGS.lineLevel, "normal");
    assert.equal(DEFAULT_SETTINGS.skipStaging, false);
  });

  it("lineLevel: few・normal・many だけ。ほかは既定(normal)に戻す", () => {
    for (const level of ["few", "normal", "many"]) {
      assert.equal(normalizeSettings({ lineLevel: level }).lineLevel, level);
    }
    for (const bad of ["", "FEW", "off", 1, null, undefined, [], {}]) {
      assert.equal(normalizeSettings({ lineLevel: bad }).lineLevel, "normal", String(bad));
    }
  });

  it("skipStaging: true だけを、オンとして受け付ける。ほかは既定(false)に戻す", () => {
    assert.equal(normalizeSettings({ skipStaging: true }).skipStaging, true);
    for (const bad of ["true", 1, null, undefined, [], {}]) {
      assert.equal(normalizeSettings({ skipStaging: bad }).skipStaging, false, String(bad));
    }
  });

  it("ほかの設定(showExplanation・simpleGraphics等)と、独立している", () => {
    const value = normalizeSettings({
      showExplanation: true,
      simpleGraphics: true,
      lineLevel: "many",
      skipStaging: true,
    });
    assert.equal(value.showExplanation, true);
    assert.equal(value.simpleGraphics, true);
    assert.equal(value.lineLevel, "many");
    assert.equal(value.skipStaging, true);
  });
});

describe("画面(HTML): 「セリフの表示」の選択欄と「演出を自動で飛ばす」のチェックボックスがある", () => {
  const html = read("public/games/escape-boss/index.html");

  it("data-line-level の選択欄(少なめ・ふつう・多め)がある", () => {
    assert.match(html, /<select[\s\S]*?id="line-level"[\s\S]*?data-line-level[\s\S]*?>/);
    for (const value of ["few", "normal", "many"]) {
      assert.match(html, new RegExp(`<option value="${value}">`));
    }
  });

  it("data-skip-staging のチェックボックスと、対応するラベルがある", () => {
    assert.match(html, /<input type="checkbox" id="skip-staging" data-skip-staging \/>/);
    assert.match(html, /<label for="skip-staging">演出を自動で飛ばす/);
  });

  it("用語確認では隠す、専用の枠組み(data-line-option・data-staging-option)を使う", () => {
    assert.match(html, /data-line-option/);
    assert.match(html, /data-staging-option/);
  });
});

describe("view.js: 選択欄・チェックボックスの配線", () => {
  const view = read("public/assets/js/games/escape-boss/view.js");

  it("bind() は onLineLevelChange・onSkipStagingChange を受け取り、change で呼ぶ", () => {
    assert.match(view, /onLineLevelChange,/);
    assert.match(view, /onSkipStagingChange,/);
    assert.match(
      view,
      /\$\("\[data-line-level\]"\)\.addEventListener\("change", \(event\) =>\s*onLineLevelChange\(event\.target\.value\),\s*\);/,
    );
    assert.match(
      view,
      /\$\("\[data-skip-staging\]"\)\.addEventListener\("change", \(event\) =>\s*onSkipStagingChange\(event\.target\.checked\),\s*\);/,
    );
  });

  it("setLineLevelSetting・setSkipStagingSetting は、保存された設定を、画面へ反映する", () => {
    const lineFn = view.slice(
      view.indexOf("setLineLevelSetting(level)"),
      view.indexOf("setLineLevelSetting(level)") + 100,
    );
    assert.match(lineFn, /\$\("\[data-line-level\]"\)\.value = level;/);
    const stagingFn = view.slice(
      view.indexOf("setSkipStagingSetting(checked)"),
      view.indexOf("setSkipStagingSetting(checked)") + 100,
    );
    assert.match(stagingFn, /\$\("\[data-skip-staging\]"\)\.checked = checked;/);
  });

  it("applyMode: 用語確認では、セリフの表示・演出を自動で飛ばすの設定欄を隠す(演出・セリフがそもそもないため)", () => {
    const fn = view.slice(view.indexOf("function applyMode"), view.indexOf("function option"));
    assert.match(fn, /\$\("\[data-line-option\]"\)\.hidden = check;/);
    assert.match(fn, /\$\("\[data-staging-option\]"\)\.hidden = check;/);
  });
});

describe("main.js: 設定の読み込み・保存・セリフ/演出への反映", () => {
  const main = read("public/assets/js/games/escape-boss/main.js");

  it("初期化時に、保存されている設定を反映する", () => {
    assert.match(main, /view\.setLineLevelSetting\(settings\.lineLevel\);/);
    assert.match(main, /view\.setSkipStagingSetting\(settings\.skipStaging\);/);
  });

  it("変更されたら、保存する", () => {
    assert.match(
      main,
      /onLineLevelChange: \(level\) => \{\s*settings = normalizeSettings\(\{ \.\.\.settings, lineLevel: level \}\);\s*saveSettings\(backend, settings\);\s*view\.setLineLevelSetting\(settings\.lineLevel\);\s*\},/,
    );
    assert.match(
      main,
      /onSkipStagingChange: \(checked\) => \{\s*settings = \{ \.\.\.settings, skipStaging: checked \};\s*saveSettings\(backend, settings\);\s*\},/,
    );
  });

  it("セリフの吹き出しの表示時間は、lineLevelOf(settings.lineLevel).bubbleMs を使う", () => {
    assert.match(
      main,
      /if \(line\) view\.showBubble\(session\.role\.name, line, lineLevelOf\(settings\.lineLevel\)\.bubbleMs\);/,
    );
  });

  it("演出を自動で飛ばす設定は、開始・終わりの演出を、始めた直後に飛ばす", () => {
    const skipPattern =
      /timeline\.start\(\);[\s\S]*?if \(settings\.skipStaging\) timeline\.skip\(\);/;
    const introFn = main.slice(main.indexOf("function beginIntro"));
    const intro = introFn.slice(0, introFn.indexOf("\nfunction "));
    assert.match(intro, skipPattern);
    const outroFn = main.slice(main.indexOf("function beginOutro"));
    const outro = outroFn.slice(0, outroFn.indexOf("\nfunction "));
    assert.match(outro, skipPattern);
  });
});
