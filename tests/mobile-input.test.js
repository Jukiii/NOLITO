// モバイル・ソフトウェアキーボード対応・縦横自動調整(Phase 22 PR1)のテスト。下部固定バーは Issue #154 で廃止した。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

describe("ゲームの 4 つの画面の切り替え", () => {
  const view = read("public/assets/js/games/escape-boss/view.js");

  it("入力欄・結果・用語確認結果・ダッシュボードの4つの画面は、すべて showView() 経由で切り替わる(直接 hidden を書き換えない)", () => {
    const calls = [...view.matchAll(/showView\("([a-zA-Z-]+)"\)/g)].map((m) => m[1]);
    assert.deepEqual(new Set(calls), new Set(["dashboard", "play", "checkResult", "result"]));
  });
});

describe("ソフトウェアキーボードが開いたときだけ、入力欄を見える位置にスクロールする", () => {
  const view = read("public/assets/js/games/escape-boss/view.js");

  it("visualViewport の resize(キーボードの開閉で起きる)で、フォーカス中なら scrollIntoView する", () => {
    assert.match(
      view,
      /window\.visualViewport\?\.addEventListener\("resize", \(\) => \{\s*if \(document\.activeElement === input\) inputBox\.scrollIntoView\(\{ block: "nearest" \}\);\s*\}\);/,
    );
  });

  it("input.focus() のたび(ゲーム開始時の自動フォーカス等)には、動かさない(デスクトップで意図せず画面が動かないように)", () => {
    const focusHandler = view.slice(
      view.indexOf('input.addEventListener("focus"'),
      view.indexOf('input.addEventListener("blur"'),
    );
    assert.ok(!focusHandler.includes("scrollIntoView"));
  });

  it("ゲームの input.focus() の呼び出しは、すべて preventScroll: true(ブラウザ自身の自動スクロールも止める)", () => {
    // コード中の実際の呼び出し(; で終わる行)だけを見る。コメント中の "input.focus()" は対象外
    const calls = [...view.matchAll(/^\s*input\.focus\(([^)]*)\);/gm)].map((m) => m[1]);
    assert.ok(calls.length >= 2, calls.length);
    for (const args of calls) assert.match(args, /preventScroll:\s*true/, args);
  });
});

describe("横向き(landscape)の低い画面では、縦の余白・場面の高さを詰める", () => {
  const gameCss = read("public/assets/css/game.css");

  it("orientation: landscape のメディアクエリがある", () => {
    assert.match(gameCss, /@media \(orientation: landscape\) and \(height <= 32rem\)/);
  });

  it("並び順(距離ゲージ→場面→単語→入力欄)を変える書き方(order・flex-direction の変更等)をしていない", () => {
    const start = gameCss.indexOf("@media (orientation: landscape)");
    // メディアクエリの中の、閉じの "}}"(最後のルールの閉じ + メディアクエリ自体の閉じ)までを取り出す
    const end = gameCss.indexOf("\n}\n", gameCss.indexOf("{", start));
    const block = gameCss.slice(start, end);
    assert.ok(!/\border\s*:/.test(block), block);
    assert.ok(!/flex-direction/.test(block));
  });
});

describe("既存のソフトウェアキーボード対応(すでに満たしている前提の確認)", () => {
  const inputJs = read("public/assets/js/games/escape-boss/input.js");
  const html = read("public/games/escape-boss/index.html");

  it("input.js は、keydown ではなく input イベントで文字を読む(ソフトウェアキーボード対応)", () => {
    // 文字を取り出すのは、input イベントのハンドラだけ(onChar を呼ぶのは、ここだけ)
    assert.match(inputJs, /input\.addEventListener\("input"/);
    assert.equal((inputJs.match(/onChar\(/g) ?? []).length, 1);
    const inputHandler = inputJs.slice(
      inputJs.indexOf('input.addEventListener("input"'),
      inputJs.indexOf('input.addEventListener("keydown"'),
    );
    assert.match(inputHandler, /onChar\(/);
    // keydown は、Enter でのフォーム誤送信を止めるためだけに使う(文字の読み取りには使わない)
    const keydownHandler = inputJs.slice(inputJs.indexOf('input.addEventListener("keydown"'));
    assert.ok(!keydownHandler.includes("onChar"));
  });

  it("入力欄に、自動補正・自動大文字化・スペルチェックを止める属性がある", () => {
    const start = html.indexOf('id="game-input"');
    const field = html.slice(start, html.indexOf("/>", start));
    assert.match(field, /autocapitalize="none"/);
    assert.match(field, /autocorrect="off"/);
    assert.match(field, /spellcheck="false"/);
  });
});

describe("kii-michiの「キーを押して入力」は、物理キーボード前提(既知の制限。対応しない)", () => {
  it("event.code(位置)で読む設計を保つ(タッチの仮想キーボードは対象外)", () => {
    const keys = read("public/assets/js/tools/kii-michi/keys.js");
    assert.match(keys, /event\.code/);
  });
});

describe("スマホの横幅は、いつも 100%(Issue #154)", () => {
  const baseCss = read("public/assets/css/base.css");

  it("html・body は、はみ出した部品で、横にずれない(overflow-x)", () => {
    assert.match(baseCss, /html \{[^}]*max-width: 100%;[^}]*overflow-x: hidden;/);
    assert.match(baseCss, /body \{[^}]*max-width: 100%;[^}]*overflow-x: clip;/);
  });

  it("select・input・textarea は、親より広がらない", () => {
    assert.match(baseCss, /select,\s*input,\s*textarea \{\s*max-width: 100%;/);
  });

  it("下部固定バーは、もうない(ナビは、ヘッダーのメニューだけ)", () => {
    const all = [
      "public/assets/css/layout.css",
      "public/assets/css/tokens.css",
      "public/assets/js/main.js",
      "public/assets/js/config/nav.js",
    ]
      .map(read)
      .join("\n");
    assert.ok(!/bottom-nav|bottomNav|BottomNav/.test(all));
  });
});
