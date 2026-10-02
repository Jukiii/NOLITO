// コマ送りの絵(スプライトシート)と、見えない入力欄(Issue #166 PR 5)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const css = read("public/assets/css/game.css");
const html = read("public/games/escape-boss/index.html");
const view = read("public/assets/js/games/escape-boss/view.js");

describe("コマ送りの絵", () => {
  it("枠(overflow: hidden)の中に、6 倍の幅の絵を置き、steps(6) で、コマを送る", () => {
    assert.match(css, /\.scene__chaser-img\s*\{[^}]*overflow: hidden/);
    assert.match(css, /\.scene__player\s*\{[^}]*overflow: hidden/);
    assert.match(css, /\.scene__sprite\s*\{[^}]*width: 600%/);
    assert.match(
      css,
      /animation: sprite-frames var\(--sprite-cycle, [\d.]+s\) steps\(6\) infinite/,
    );
    assert.match(
      css,
      /@keyframes sprite-frames\s*\{[^}]*\}\s*to\s*\{\s*transform: translateX\(-100%\)/,
    );
  });

  it("画面の 3 枚(追ってくる人・ふつうの顔・焦った顔)が、枠 + 絵の形で、飾り(alt が空)", () => {
    const sprites = html.match(/<img\s+class="scene__sprite"[^>]*>/g) ?? [];
    assert.equal(sprites.length, 3);
    for (const tag of sprites) assert.match(tag, /alt=""/);
  });

  it("コマ送りの速さは、役職の動きごとに決まる(5 つの動きすべてが、サイクルを持つか既定を使う)", () => {
    for (const motion of ["pedal", "drive", "glide", "aura"]) {
      assert.match(
        css,
        new RegExp(`data-motion="${motion}"\\] \\.scene__chaser-img[^{]*\\{\\s*--sprite-cycle`),
      );
    }
  });
});

describe("入力欄は、画面に見せない(フォーカスは受け取れる)", () => {
  it("CSS: 1px に切り抜いて隠す。display: none・visibility: hidden にしない(入力を受けられなくなる)", () => {
    const block = /\.game-input__label,\s*\.game-input__field\s*\{([^}]*)\}/.exec(css);
    assert.ok(block, "隠す規則がありません");
    assert.match(block[1], /position: absolute/);
    assert.match(block[1], /clip-path: inset\(50%\)/);
    const field = /\.game-input__field\s*\{([^}]*)\}/g;
    for (const m of css.matchAll(field)) {
      assert.ok(!/display:\s*none|visibility:\s*hidden/.test(m[1]));
    }
  });

  it("入力欄(<input>)とラベルは、HTML に残る。単語のカードを押すと、入力欄にフォーカスする", () => {
    assert.match(html, /<label class="game-input__label" for="game-input">/);
    assert.match(html, /id="game-input"/);
    assert.match(
      view,
      /\$\("\.game-word"\)\.addEventListener\("click", \(\) => input\.focus\(\{ preventScroll: true \}\)\)/,
    );
  });
});
