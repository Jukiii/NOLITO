// タッチ操作の点検(Phase 22 PR2)のテスト。新機能ではなく、既存実装の点検・回帰防止。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

describe("職種・役職の選択(job-option): ラベル全体がタップ対象(実ブラウザのタッチE2Eで確認済み)", () => {
  const css = read("public/assets/css/game.css");

  it("input(実際のラジオボタン)は、透明なまま、ラベル全体(inset: 0)を覆う", () => {
    const block = css.slice(
      css.indexOf(".job-option__input {"),
      css.indexOf(".job-option__label {"),
    );
    assert.match(block, /position:\s*absolute;/);
    assert.match(block, /inset:\s*0;/);
    assert.match(block, /width:\s*100%;/);
    assert.match(block, /height:\s*100%;/);
    assert.match(block, /opacity:\s*0;/);
  });

  it("ラベル自体も、タップしやすい高さ(--tap-size)を持つ", () => {
    const block = css.slice(
      css.indexOf(".job-option__label {"),
      css.indexOf(".job-option__label::before"),
    );
    assert.match(block, /min-height:\s*var\(--tap-size\);/);
  });
});

describe("チェックボックス・select・ボタンの、タップサイズ(--tap-size = 44px相当)", () => {
  const gameCss = read("public/assets/css/game.css");
  const accountCss = read("public/assets/css/account.css");
  const componentsCss = read("public/assets/css/components.css");
  const layoutCss = read("public/assets/css/layout.css");

  it("ゲームの設定のチェックボックス・スライダー(.game-setup__option input)は --tap-size", () => {
    const block = gameCss.slice(
      gameCss.indexOf(".game-setup__option input {"),
      gameCss.indexOf(".game-setup__option input {") + 200,
    );
    assert.match(block, /width:\s*var\(--tap-size\);/);
    assert.match(block, /height:\s*var\(--tap-size\);/);
  });

  it("アカウントページのチェックボックス(.account__checkbox input)は --tap-size", () => {
    const block = accountCss.slice(
      accountCss.indexOf(".account__checkbox input {"),
      accountCss.indexOf(".account__checkbox input {") + 150,
    );
    assert.match(block, /width:\s*var\(--tap-size\);/);
    assert.match(block, /height:\s*var\(--tap-size\);/);
  });

  it("共通のボタン(.button)は、min-height: --tap-size", () => {
    assert.match(componentsCss, /\.button\s*\{[^}]*min-height:\s*var\(--tap-size\);/s);
  });

  it("ヘッダー・フッター・下部固定バー・検索・ダイアログの、主なタップ対象は --tap-size を使う(5箇所以上)", () => {
    const count = (layoutCss.match(/min-height:\s*var\(--tap-size\)/g) ?? []).length;
    assert.ok(count >= 5, count);
  });
});

describe("チャート(chart.js)は、あらかじめタッチを想定した設計(なぞらず、タップだけでも値が出る)", () => {
  const chart = read("public/assets/js/games/escape-boss/chart.js");

  it("pointerdown でも、pointermove と同じ処理(track)を呼ぶ(タップだけで値が出る)", () => {
    assert.match(chart, /plotBox\.addEventListener\("pointermove", track\);/);
    assert.match(chart, /plotBox\.addEventListener\("pointerdown", track\);/);
  });

  it("pointerleave での非表示は、マウスだけに限る(タッチでは、離しても値が残る)", () => {
    const block = chart.slice(
      chart.indexOf('plotBox.addEventListener("pointerleave"'),
      chart.indexOf('plotBox.addEventListener("focus"'),
    );
    assert.match(block, /event\.pointerType === "mouse"/);
  });

  it("キーボードでも操作できる(focus・矢印キー)。マウス・タッチ専用の機能ではない", () => {
    assert.match(chart, /plotBox\.addEventListener\("focus"/);
    assert.match(chart, /plotBox\.addEventListener\("keydown"/);
  });
});

describe("色・見た目だけの :hover に、機能を隠していない(タッチでは :hover が働かないため)", () => {
  it("すべての :hover は、色の変化だけ(隠れているものを表示する等の、機能上の依存がない)", () => {
    const files = [
      "public/assets/css/base.css",
      "public/assets/css/components.css",
      "public/assets/css/home.css",
      "public/assets/css/layout.css",
    ];
    for (const file of files) {
      const css = read(file);
      const rules = [...css.matchAll(/([^{}]+:hover[^{}]*)\{([^}]*)\}/g)];
      for (const [, selector, body] of rules) {
        assert.ok(
          !/display:\s*(block|flex|grid|inline)|visibility:\s*visible|opacity:\s*1\b/.test(body) ||
            /color|background|text-decoration|box-shadow/.test(body),
          `${file}: ${selector.trim()}`,
        );
      }
    }
  });
});

describe("モーダル(共通部品)は、タップでも開閉できる(実ブラウザのタッチE2Eで確認済み)", () => {
  const modalJs = read("public/assets/js/components/modal.js");

  it("開閉は click イベント(タップは、ブラウザが click に変換する。タッチ専用の判定はしていない)", () => {
    assert.match(modalJs, /addEventListener\("click"/);
  });
});
