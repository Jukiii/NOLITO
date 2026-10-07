// アーケード風のゲーム画面(Issue #166 PR 1)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const css = read("public/assets/css/game.css");

describe("game.css のゲーム画面", () => {
  it("色の直書きは、ない(トークンだけ)", () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(code), "色の直書き");
    assert.ok(!/\b(?:rgb|hsl)a?\(/.test(code), "rgb()・hsl() の直書き");
  });

  it("ゲーム画面は現在のテーマの色・形を使い、光らせない", () => {
    const start = css.indexOf(".game-setup {\n  --color-bg");
    assert.equal(start, -1);
    const blockStart = css.indexOf(".game-result,\n.game-play,\n.game-setup {");
    const block = css.slice(blockStart, css.indexOf("\n}\n", blockStart));
    assert.match(block, /background: var\(--color-surface\)/);
    assert.match(block, /color: var\(--color-text\)/);
    assert.match(block, /border-radius: var\(--radius-md\)/);
    assert.match(block, /--shadow-pop: 0 2px 0 var\(--color-border\)/);
    assert.ok(!/--arcade-|text-shadow:|color-scheme: dark/.test(css));
  });

  it("プレイ中は、ヘッダー・フッター(ほかのページへのリンク)を隠す。スキップリンクは隠さない", () => {
    assert.match(
      css,
      /body:has\(\[data-game\] \[data-view="play"\]:not\(\[hidden\]\)\) \.site-header,\s*body:has\(\[data-game\] \[data-view="play"\]:not\(\[hidden\]\)\) \.site-footer\s*\{\s*display: none;/,
    );
    assert.ok(!/skip-link[^{]*\{[^}]*display: none/.test(css));
  });

  it("「やめる」「音」は、画面の中に、いつもある(HTML に残り、表示の場所を持つ)", () => {
    const html = read("public/games/escape-boss/index.html");
    assert.ok(html.includes("data-quit"));
    assert.ok(html.includes("data-sound-toggle"));
    assert.match(css, /\.game-play \[data-quit\]\s*\{[^}]*grid-area: quit/);
    assert.match(css, /\.game-play \[data-sound-toggle\]\s*\{[^}]*grid-area: sound/);
  });

  it("危険のゲージの光は、1 周 0.8 秒以上(光の点滅を避ける)", () => {
    const match = /animation:\s*gauge-danger\s+([\d.]+)s/.exec(css);
    assert.ok(match, "gauge-danger の指定がない");
    assert.ok(Number(match[1]) >= 0.8);
    assert.match(css, /@keyframes gauge-danger/);
  });

  it("流れる背景は、定義があり、使われている。終わりの演出では止まる", () => {
    assert.match(css, /@keyframes scene-scroll/);
    assert.match(css, /animation: scene-scroll 14s linear infinite/);
    assert.match(
      css,
      /\.scene\[data-stage="clear"\],\s*\.scene\[data-stage="over"\]\s*\{\s*animation: none/,
    );
  });

  it("プレイ中は職場・先輩・プレイヤー・道路のシーンを全画面背景に広げる", () => {
    const baseCss = read("public/assets/css/base.css");
    const html = read("public/games/escape-boss/index.html");
    assert.match(
      css,
      /body:has\(\[data-game\] \[data-view="play"\]:not\(\[hidden\]\)\) \.game-play \.scene\s*\{[\s\S]*position: fixed;[\s\S]*z-index: -1;[\s\S]*inset: 0;[\s\S]*height: 100vh;[\s\S]*height: 100dvh;/,
    );
    assert.match(
      css,
      /body:has\(\[data-game\] \[data-view="play"\]:not\(\[hidden\]\)\) \.game-play \.scene\s*\{[\s\S]*--chaser-w: min\(56vw, 48vh\);[\s\S]*--player-w: min\(32vw, 32vh\);[\s\S]*opacity: 0\.62;/,
    );
    assert.match(css, /@media \(width <= 30rem\)[\s\S]*--chaser-w: min\(56vw, 38vh\);/);
    assert.match(html, /class="scene"[^>]*data-chase-only/);
    assert.match(html, /class="scene__road"/);
    assert.match(html, /data-chaser/);
    assert.match(html, /class="scene__player scene__player--calm"/);
    assert.doesNotMatch(css, /game-backdrop-chaser|game-backdrop-player|game-backdrop-chase/);
    assert.match(
      baseCss,
      /prefers-reduced-motion: reduce[\s\S]*animation-duration: 0\.01ms !important/,
    );
    assert.match(
      baseCss,
      /:root\[data-reduced-motion="reduce"\][\s\S]*animation-duration: 0\.01ms !important/,
    );
  });

  it("入力画面は上下中央に置き、セリフと開始/終了バナーは独立した前面レイヤーにする", () => {
    assert.match(css, /\.game-play\s*\{[^}]*align-content: center;[^}]*min-height: calc\(100dvh/);
    assert.match(
      css,
      /\.game-scene-overlay\s*\{[^}]*position: fixed;[^}]*z-index: var\(--z-header\)/,
    );
    assert.match(css, /\.game-scene-overlay\[data-stage="clear"\] \.scene__banner-hint/);
    const html = read("public/games/escape-boss/index.html");
    const scene = html.slice(
      html.indexOf('<div class="scene"'),
      html.indexOf('</div>\n              <div class="game-scene-overlay"'),
    );
    const overlay = html.slice(
      html.indexOf('<div class="game-scene-overlay"'),
      html.indexOf('<div class="game-word"'),
    );
    assert.ok(!scene.includes("data-banner"));
    assert.ok(!scene.includes("data-bubble"));
    assert.ok(overlay.includes("data-banner"));
    assert.ok(overlay.includes("data-bubble"));
  });

  it("乗り物役職は右向きに反転し、先輩は元の向きを保つ。動きは細かく揺れすぎない", () => {
    assert.match(
      css,
      /\.scene:not\(\[data-motion="run"\]\) \.scene__chaser-img \.scene__sprite\s*\{[^}]*scale: -1 1/,
    );
    assert.doesNotMatch(
      css,
      /\.scene\[data-motion="run"\] \.scene__chaser-img \.scene__sprite\s*\{[^}]*scale:/,
    );
    assert.match(
      css,
      /\.scene\[data-motion="pedal"\] \.scene__chaser-img\s*\{[^}]*scene-pedal 0\.8s/,
    );
    assert.match(
      css,
      /\.scene\[data-motion="drive"\] \.scene__chaser-img\s*\{[^}]*scene-drive 0\.24s/,
    );
    assert.match(
      css,
      /\.scene\[data-motion="glide"\] \.scene__chaser-img\s*\{[^}]*scene-glide 1\.6s/,
    );
    assert.ok(!css.includes("scene-gloss"));
  });

  it("追いかける背景はプレイ枠の内側にも見え、お題カードは半透明にする", () => {
    assert.match(
      css,
      /body:has\(\[data-game\] \[data-view="play"\]:not\(\[hidden\]\)\) \.game-play\s*\{\s*background: transparent;/,
    );
    assert.match(
      css,
      /body:has\(\[data-game\] \[data-view="play"\]:not\(\[hidden\]\)\) \.game-play \.game-word\s*\{\s*background: color-mix\(in srgb, var\(--color-surface\) 86%, transparent\);/,
    );
    assert.match(css, /opacity: 0\.48;/);
  });

  it("危ないときの場面は、背景の流れを残したまま、縁も脈打つ", () => {
    const start = css.indexOf(".scene.is-danger {");
    const block = css.slice(start, css.indexOf("}", start));
    assert.match(block, /scene-scroll 14s linear infinite/);
    assert.match(block, /scene-danger 1\.2s/);
  });

  it("狭い画面(360px)で、はみ出さない: HUD は折り返し、グリッドの列は minmax(0, 1fr)", () => {
    assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    const start = css.indexOf(".game-status {");
    const block = css.slice(start, css.indexOf("}", start));
    assert.match(block, /flex-wrap: wrap/);
  });

  it("入力欄のあるプレイ画面に、開閉の部品(details)を置かない", () => {
    const html = read("public/games/escape-boss/index.html");
    const start = html.indexOf('data-view="play"');
    const end = html.indexOf('data-view="result"', start);
    assert.ok(start > 0 && end > start);
    assert.ok(!/<details/.test(html.slice(start, end)));
  });

  it("横向きの低い画面の規則は、ファイルの末尾(あとに来る必要がある)", () => {
    const at = css.indexOf("@media (orientation: landscape) and (height <= 32rem)");
    assert.ok(at > 0);
    assert.ok(!css.slice(at).includes("\n.scene {"), "末尾のあとに、場面の規則がない");
  });
});
