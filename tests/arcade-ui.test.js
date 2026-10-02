// アーケード風のゲーム画面(Issue #166 PR 1)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const tokens = read("public/assets/css/tokens.css");
const css = read("public/assets/css/game.css");

const channel = (value) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex;
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const arcade = Object.fromEntries(
  [...tokens.matchAll(/--(arcade-[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)].map((m) => [
    m[1],
    m[2],
  ]),
);

describe("アーケード画面のトークン", () => {
  it("暗い画面の文字・光る色は、背景に対して、読める明るさの比(4.5 以上)", () => {
    for (const bg of ["arcade-bg", "arcade-panel", "arcade-panel-2"]) {
      for (const fg of [
        "arcade-text",
        "arcade-text-muted",
        "arcade-cyan",
        "arcade-yellow",
        "arcade-green",
        "arcade-red",
        "arcade-magenta",
      ]) {
        const ratio = contrast(arcade[fg], arcade[bg]);
        assert.ok(ratio >= 4.5, `${fg} / ${bg}: ${ratio.toFixed(2)}`);
      }
    }
  });

  it("明るい色の上の文字(on-bright)も、読める", () => {
    for (const bg of ["arcade-red", "arcade-yellow", "arcade-cyan", "arcade-green"]) {
      assert.ok(contrast(arcade["arcade-on-bright"], arcade[bg]) >= 4.5, bg);
    }
  });

  it("場面の窓は、固定の明るい色で、文字・補助の文字・主色が読める", () => {
    for (const bg of ["arcade-scene-top", "arcade-scene-bottom"]) {
      for (const fg of ["arcade-scene-ink", "arcade-scene-text-muted", "arcade-scene-primary"]) {
        assert.ok(contrast(arcade[fg], arcade[bg]) >= 4.5, `${fg} / ${bg}`);
      }
    }
  });

  it("テーマでは上書きしない(どのテーマでも同じ暗い画面)", () => {
    const afterRoot = tokens.slice(tokens.indexOf("\n}\n"));
    assert.ok(!/--arcade-/.test(afterRoot));
  });
});

describe("game.css のアーケード画面", () => {
  it("色の直書きは、ない(トークンだけ)", () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(code), "色の直書き");
    assert.ok(!/\b(?:rgb|hsl)a?\(/.test(code), "rgb()・hsl() の直書き");
  });

  it("ゲーム画面は、どのテーマでも暗い(.game-play がトークンを暗い値にする)", () => {
    const start = css.indexOf(".game-play {");
    const block = css.slice(start, css.indexOf("\n}\n", start));
    assert.match(block, /--color-bg:\s*var\(--arcade-bg\)/);
    assert.match(block, /--color-text:\s*var\(--arcade-text\)/);
    assert.match(block, /color-scheme:\s*dark/);
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
