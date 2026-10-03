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

  it("画面の 4 枚(追ってくる人・ふつうの顔・焦った顔・準備の画面のあなた)が、枠 + 絵の形で、飾り(alt が空)", () => {
    const sprites = html.match(/<img\s+class="scene__sprite"[^>]*>/g) ?? [];
    assert.equal(sprites.length, 4);
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
    const block =
      /\.game-input \.game-input__label,\s*\.game-input \.game-input__field\s*\{([^}]*)\}/.exec(
        css,
      );
    assert.ok(block, "隠す規則がありません");
    assert.match(block[1], /position: absolute/);
    assert.match(block[1], /clip-path: inset\(50%\)/);
    const field = /\.game-input[^{,]*__field\s*\{([^}]*)\}/g;
    for (const m of css.matchAll(field)) {
      assert.ok(!/display:\s*none|visibility:\s*hidden/.test(m[1]));
    }
  });

  it("隠すのは .game-input の中だけ。同じクラスの選択欄(設定・成績・プロフィール)は、隠さない(Issue #173)", () => {
    // 隠す規則は、必ず .game-input の中に限る(クラス単独の規則で隠さない)
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of code.matchAll(/([^{}]*)\{([^}]*clip-path: inset\(50%\)[^}]*)\}/g)) {
      for (const selector of m[1].split(",")) {
        if (/game-input__(label|field)/.test(selector)) {
          assert.match(selector.trim(), /^\.game-input \./, selector.trim());
        }
      }
    }
    // 入力欄の外で、同じクラスを使う欄(職種・追ってくる人の選択など)が、HTML に残っている
    const setup = html.slice(html.indexOf("data-setup"), html.indexOf('data-view="play"'));
    assert.match(
      setup,
      /<select[^>]*class="game-input__field game-setup__select"[^>]*data-job-list/,
    );
    assert.match(
      setup,
      /<select[^>]*class="game-input__field game-setup__select"[^>]*data-role-list/,
    );
    assert.ok(!/class="game-input"/.test(setup));
  });

  it("入力欄の外の選択欄は、ページの面の色(--color-surface)に、文字の色(--color-text)。暗い固定色にしない(読めなくなる)", () => {
    const rule = /\n\.game-input__field\s*\{([^}]*)\}/.exec(css);
    assert.ok(rule, "選択欄の規則がありません");
    assert.match(rule[1], /background: var\(--color-surface\)/);
    assert.match(rule[1], /color: var\(--color-text\)/);
    assert.ok(!rule[1].includes("--arcade-"));
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
