// 役職別のクリア・ゲームオーバー演出(Phase 17 PR 3)のテスト: 見せ方の検証(純粋)・roles.json・CSS・画面のつなぎ。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { OUTRO_STYLES, outroStyleOf } from "../public/assets/js/games/escape-boss/scene.js";
import { OUTRO_MS } from "../public/assets/js/games/escape-boss/staging.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const roles = JSON.parse(read("public/data/roles.json"));
const byId = Object.fromEntries(roles.map((role) => [role.id, role]));

describe("OUTRO_STYLES・outroStyleOf(見せ方の検証)", () => {
  it("クリア 5 種類・ゲームオーバー 5 種類。重複がなく、書き換えられない", () => {
    assert.deepEqual(Object.keys(OUTRO_STYLES), ["clear", "over"]);
    assert.deepEqual([...OUTRO_STYLES.clear], ["collapse", "tumble", "stall", "depart", "ascend"]);
    assert.deepEqual([...OUTRO_STYLES.over], ["grab", "pass", "skid", "shine", "engulf"]);
    assert.ok(
      Object.isFrozen(OUTRO_STYLES) &&
        Object.isFrozen(OUTRO_STYLES.clear) &&
        Object.isFrozen(OUTRO_STYLES.over),
    );
    const all = [...OUTRO_STYLES.clear, ...OUTRO_STYLES.over];
    assert.equal(new Set(all).size, all.length);
    for (const name of all) assert.match(name, /^[a-z]+$/);
  });

  it("決まった見せ方だけを返す。kind が違う・知らない値・文字でない値・__proto__ などは null", () => {
    assert.equal(
      outroStyleOf({ scene: { outro: { clear: "tumble", over: "pass" } } }, "clear"),
      "tumble",
    );
    assert.equal(
      outroStyleOf({ scene: { outro: { clear: "tumble", over: "pass" } } }, "over"),
      "pass",
    );
    // クリアの見せ方を、ゲームオーバーに使えない(逆も同じ)
    assert.equal(
      outroStyleOf({ scene: { outro: { clear: "pass", over: "tumble" } } }, "clear"),
      null,
    );
    assert.equal(
      outroStyleOf({ scene: { outro: { clear: "pass", over: "tumble" } } }, "over"),
      null,
    );
    for (const bad of [
      "boom",
      "",
      "COLLAPSE",
      " collapse",
      "collapse ",
      "__proto__",
      "constructor",
      "toString",
      5,
      null,
      undefined,
      [],
      {},
      true,
    ]) {
      assert.equal(
        outroStyleOf({ scene: { outro: { clear: bad, over: bad } } }, "clear"),
        null,
        String(bad),
      );
      assert.equal(
        outroStyleOf({ scene: { outro: { clear: bad, over: bad } } }, "over"),
        null,
        String(bad),
      );
    }
  });

  it("役職・scene・outro がない、または、kind が知らない値でも、null(落ちない)", () => {
    for (const role of [
      undefined,
      null,
      {},
      { scene: null },
      { scene: {} },
      { scene: { outro: null } },
      { scene: { outro: "x" } },
      5,
    ]) {
      assert.equal(outroStyleOf(role, "clear"), null, JSON.stringify(role));
    }
    const role = { scene: { outro: { clear: "tumble", over: "pass" } } };
    for (const kind of [
      "cleared",
      "gameover",
      "__proto__",
      "constructor",
      "",
      undefined,
      null,
      1,
    ]) {
      assert.equal(outroStyleOf(role, kind), null, String(kind));
    }
  });
});

describe("roles.json の scene.outro", () => {
  it("すべての役職に、クリアとゲームオーバーの見せ方がある(有効な値)。10 種類、すべて違う", () => {
    const styles = [];
    for (const role of roles) {
      assert.deepEqual(Object.keys(role.scene.outro).sort(), ["clear", "over"], role.id);
      assert.ok(outroStyleOf(role, "clear"), `${role.id}.clear`);
      assert.ok(outroStyleOf(role, "over"), `${role.id}.over`);
      styles.push(role.scene.outro.clear, role.scene.outro.over);
    }
    assert.equal(styles.length, 10);
    assert.equal(new Set(styles).size, 10);
  });

  it("役職ごと: 先輩 = へたり込む・飛びつく / 係長 = 転ぶ・追い越す / 部長 = 止まる・急ブレーキ / 社長 = 去る・輝く / 会長 = 上昇・オーラ", () => {
    const pair = (id) => [byId[id].scene.outro.clear, byId[id].scene.outro.over];
    assert.deepEqual(pair("senpai"), ["collapse", "grab"]);
    assert.deepEqual(pair("kakaricho"), ["tumble", "pass"]);
    assert.deepEqual(pair("buchou"), ["stall", "skid"]);
    assert.deepEqual(pair("shachou"), ["depart", "shine"]);
    assert.deepEqual(pair("kaicho"), ["ascend", "engulf"]);
  });

  it("動き(scene.motion)は、そのまま(5 種類)", () => {
    assert.deepEqual(
      roles.map((role) => role.scene.motion),
      ["run", "pedal", "drive", "glide", "aura"],
    );
  });
});

describe("CSS", () => {
  const css = read("public/assets/css/game.css");
  const scene = css.slice(
    css.indexOf("/* 追跡シーン"),
    css.indexOf("/* ダッシュボードのセクション */"),
  );
  const outro = scene.slice(
    scene.indexOf("/* 役職別の、終わりの演出"),
    scene.indexOf("/* 動きを減らす設定: 動く飾り"),
  );
  const keyframes = new Map(
    [...css.matchAll(/@keyframes ([a-z0-9-]+)\s*\{([\s\S]*?)\n\}\n/g)].map((m) => [m[1], m[2]]),
  );

  it("10 種類すべてに、専用の規則がある(.scene[data-stage=…][data-outro=…])。共通の演出(フォールバック)も残っている", () => {
    for (const kind of ["clear", "over"]) {
      for (const style of OUTRO_STYLES[kind]) {
        assert.ok(
          outro.includes(`.scene[data-stage="${kind}"][data-outro="${style}"]`),
          `${kind}/${style}`,
        );
      }
    }
    for (const rule of [
      '.scene[data-stage="clear"] .scene__chaser',
      '.scene[data-stage="clear"] .scene__confetti',
      '.scene[data-stage="over"] .scene__chaser',
      '.scene[data-stage="over"] .scene__player',
    ]) {
      assert.ok(scene.includes(rule), rule);
    }
  });

  it("専用の規則は、共通の規則より、強い(あとから足しても、上書きできる。属性を 2 つ持つ)", () => {
    const selectors = [...outro.matchAll(/^(\.scene\[data-stage[^{]+)\{/gm)].map((m) => m[1]);
    assert.ok(selectors.length >= 10);
    for (const selector of selectors)
      assert.match(selector, /\[data-stage="(clear|over)"\]\[data-outro="[a-z]+"\]/);
  });

  it("専用の演出の動きは、すべて、最後の状態で止まる(forwards)。動きを減らす設定でも、その状態になる。0.8〜1.1 秒(演出の 1.2 秒以内)", () => {
    const declarations = [...outro.matchAll(/animation:\s*([^;]+);/g)].map((m) => m[1].trim());
    const used = declarations.filter((value) => value !== "none");
    assert.equal(used.length, 13);
    for (const value of used) {
      assert.match(value, /\bforwards\b/, value);
      const seconds = Number(/(\d*\.?\d+)s/.exec(value)[1]);
      assert.ok(seconds <= 1.1 && seconds >= 0.5, value);
      assert.ok(seconds * 1000 < OUTRO_MS, value);
    }
  });

  it("専用の動きの名前は、すべて @keyframes が定義されている。どれも、使われている", () => {
    const names = new Set();
    for (const match of outro.matchAll(/animation:\s*([^;]+);/g)) {
      const name = match[1].trim().split(/\s+/)[0];
      if (name !== "none") names.add(name);
    }
    for (const name of names) assert.ok(keyframes.has(name), `${name}: @keyframes がありません`);
    for (const name of [
      "scene-collapse",
      "scene-tumble",
      "scene-stall-slow",
      "scene-stall-shake",
      "scene-depart",
      "scene-ascend",
      "scene-grab",
      "scene-pass",
      "scene-skid",
      "scene-skid-tilt",
      "scene-shine-in",
      "scene-engulf",
      "scene-glow",
    ]) {
      assert.ok(names.has(name), `${name}: 使われていません`);
    }
  });

  it("ちらつかない: 色・明るさ・影は変えない。不透明度を変える 3 つ(去る・上昇・輝き)は、0.8 秒以上", () => {
    for (const name of [...keyframes.keys()].filter((key) =>
      /^scene-(collapse|tumble|stall|depart|ascend|grab|pass|skid|shine|engulf|glow)/.test(key),
    )) {
      const body = keyframes.get(name);
      assert.ok(!/filter|box-shadow|background|color:/.test(body), name);
    }
    for (const name of ["scene-depart", "scene-ascend", "scene-glow"]) {
      assert.match(keyframes.get(name), /opacity/);
      const use = [...outro.matchAll(/animation:\s*([^;]+);/g)]
        .map((m) => m[1])
        .find((value) => value.startsWith(name));
      assert.ok(Number(/(\d*\.?\d+)s/.exec(use)[1]) >= 0.8, name);
    }
  });

  it("共通の演出の動き(位置の枠 .scene__chaser・中の絵 .scene__chaser-img)を、専用の演出が、必要なぶんだけ置き換える", () => {
    // 専用の演出が、絵を動かすもの(傾き・転ぶ・揺れる・上昇・跳ねる)は、共通の位置の動き(scene-outro-back)を、止める
    for (const style of ["collapse", "tumble", "ascend"]) {
      const rule = new RegExp(
        `\\[data-outro="${style}"\\] \\.scene__chaser \\{\\s*animation: none;`,
      );
      assert.match(outro, rule, style);
    }
  });

  it("輝き(.scene__glow)は、ふだんは出ない・クリックを受けない。社長(金)と会長(主役の色)だけが出す。色はトークン", () => {
    assert.match(
      outro,
      /\.scene__glow \{[^}]*display: none;[^}]*pointer-events: none;[^}]*opacity: 0;/,
    );
    assert.match(
      outro,
      /\[data-outro="shine"\] \.scene__glow,\s*\.scene\[data-stage="over"\]\[data-outro="engulf"\] \.scene__glow \{\s*display: block;/,
    );
    assert.match(
      outro,
      /\[data-outro="engulf"\] \.scene__glow \{\s*--glow: var\(--color-primary\);/,
    );
    assert.match(outro, /var\(--glow, var\(--color-accent\)\)/);
    assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(outro), "色の直書きがあります");
  });

  it("社長のクリアの紙吹雪は、金(アクセントの色)だけ", () => {
    const block = outro.slice(
      outro.indexOf('[data-outro="depart"] .scene__confetti'),
      outro.indexOf("/* クリア: 会長"),
    );
    assert.ok(block.includes("var(--color-accent)"));
    assert.ok(!block.includes("var(--color-primary)") && !block.includes("var(--color-border)"));
  });

  it("動きを減らす設定の全体の規則は、そのまま(アニメーションだけを止める)", () => {
    const base = read("public/assets/css/base.css");
    assert.match(
      base,
      /prefers-reduced-motion: reduce[\s\S]*animation-duration: 0\.01ms !important/,
    );
  });
});

describe("画面(HTML・view.js・main.js)のつなぎ", () => {
  const html = read("public/games/escape-boss/index.html");
  const view = read("public/assets/js/games/escape-boss/view.js");
  const main = read("public/assets/js/games/escape-boss/main.js");

  it("輝きの飾りは、場面(aria-hidden)の中にある。紙吹雪の次", () => {
    const scene = html.slice(
      html.indexOf('<div class="scene"'),
      html.indexOf('<div class="game-word">'),
    );
    assert.match(scene, /aria-hidden="true"/);
    assert.match(
      scene,
      /<div class="scene__confetti" data-confetti><\/div>\s*<div class="scene__glow" data-glow><\/div>/,
    );
  });

  it("view.showStaging: クリア・ゲームオーバーのときだけ、見せ方を data-outro に入れる。画面が替わると、消す", () => {
    assert.match(view, /showStaging\(kind, text, outroStyle = null\)/);
    assert.match(
      view,
      /scene\.dataset\.outro =\s*\(kind === "clear" \|\| kind === "over"\) && outroStyle \? outroStyle : "";/,
    );
    assert.match(view, /scene\.dataset\.stage = "";\s*scene\.dataset\.outro = "";/);
  });

  it("main.js: 役職の見せ方を、scene.js の outroStyleOf で決め、終わりの演出に渡す。文字・保存・飛ばせる操作は、そのまま", () => {
    assert.match(main, /import \{ isDanger, outroStyleOf \} from "\.\/scene\.js";/);
    assert.match(main, /const outroStyle = outroStyleOf\(session\.role, kind\);/);
    assert.match(main, /onStep: \(step\) => view\.showStaging\(step\.id, step\.text, outroStyle\)/);
    const outro = main.slice(main.indexOf("function beginOutro"));
    assert.match(outro, /const kind = session\.state\.status === "cleared" \? "clear" : "over";/);
    assert.match(outro, /view\.showResult\(/);
    // 結果の保存は、演出の前(0031。この順序を変えない)
    const finish = main.slice(
      main.indexOf("function finish()"),
      main.indexOf("function beginOutro"),
    );
    assert.ok(finish.indexOf("store.update(") < finish.indexOf("beginOutro("));
  });

  it("scene.js は、DOM・時計・保存に触れない(純粋なロジックのまま)", () => {
    const source = read("public/assets/js/games/escape-boss/scene.js");
    assert.ok(
      !/\b(document|window|localStorage|sessionStorage|performance|Date|fetch)\b/.test(source),
    );
  });
});
