// 特殊ルールのプレイ中の合図と見せ場(Phase 17 PR 2)のテスト: 合図の計算(純粋)・画面・CSS。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CUE_LABELS,
  CUE_ORDER,
  activeCues,
  cueLabel,
  drainMultiplier,
  rulesOf,
} from "../public/assets/js/games/escape-boss/rules.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const roles = JSON.parse(read("public/data/roles.json"));

const SURGE = { type: "surge", every: 15, duration: 3, warn: 1, multiplier: 1.5 };
const SHOCK = { type: "shock", duration: 2, multiplier: 1.5 };
const CLOSING = { type: "closing", from: 0.5, max: 1.3 };
const all = rulesOf({ rules: [SURGE, SHOCK, CLOSING] });
const at = (over) => ({ elapsed: 0, distance: 100, shockUntil: 0, ...over });

describe("activeCues(合図の計算)", () => {
  it("何も働いていなければ、空。ルールがなくても、空", () => {
    assert.deepEqual(activeCues(all, at(), 100), []);
    assert.deepEqual(activeCues([], at({ elapsed: 13, distance: 1 }), 100), []);
    assert.deepEqual(activeCues(undefined, at(), 100), []);
    assert.deepEqual(activeCues(null, at(), 100), []);
  });

  it("ダッシュ: 予告 → ダッシュ中 → なし(周期のくり返し)", () => {
    const cue = (elapsed) => activeCues(rulesOf({ rules: [SURGE] }), at({ elapsed }), 100);
    assert.deepEqual(cue(10.9), []);
    assert.deepEqual(cue(11), ["surge-warn"]);
    assert.deepEqual(cue(11.9), ["surge-warn"]);
    assert.deepEqual(cue(12), ["surge"]);
    assert.deepEqual(cue(14.9), ["surge"]);
    assert.deepEqual(cue(15), []);
    assert.deepEqual(cue(27), ["surge"]);
  });

  it("ミスで加速: 終わる時刻の前だけ", () => {
    const cue = (elapsed, shockUntil) =>
      activeCues(rulesOf({ rules: [SHOCK] }), at({ elapsed, shockUntil }), 100);
    assert.deepEqual(cue(5, 7), ["shock"]);
    assert.deepEqual(cue(7, 7), []);
    assert.deepEqual(cue(5, 0), []);
  });

  it("追い詰め: 距離が from を切っている間だけ(ちょうど半分は、まだ)", () => {
    const cue = (distance) => activeCues(rulesOf({ rules: [CLOSING] }), at({ distance }), 100);
    assert.deepEqual(cue(100), []);
    assert.deepEqual(cue(50), []);
    assert.deepEqual(cue(49.9), ["closing"]);
    assert.deepEqual(cue(0), ["closing"]);
  });

  it("重なる: CUE_ORDER の順(予告 → ダッシュ → ミス → 追い詰め)。予告とダッシュは、同時に出ない", () => {
    assert.deepEqual(activeCues(all, at({ elapsed: 11.5, shockUntil: 13, distance: 10 }), 100), [
      "surge-warn",
      "shock",
      "closing",
    ]);
    assert.deepEqual(activeCues(all, at({ elapsed: 13, shockUntil: 14, distance: 10 }), 100), [
      "surge",
      "shock",
      "closing",
    ]);
    assert.deepEqual([...CUE_ORDER], ["surge-warn", "surge", "shock", "closing"]);
  });

  it("倍率が 1 を超えているとき(ダッシュ中・ミスで加速中・追い詰め中)と、合図が、一致する。予告の間は、倍率 1", () => {
    for (let elapsed = 0; elapsed < 60; elapsed += 0.25) {
      for (const distance of [100, 60, 50, 30, 5]) {
        for (const shockUntil of [0, elapsed + 1]) {
          const state = at({ elapsed, distance, shockUntil });
          const cues = activeCues(all, state, 100).filter((cue) => cue !== "surge-warn");
          const boosted = drainMultiplier(all, state, 100) > 1;
          assert.equal(cues.length > 0, boosted, JSON.stringify(state));
        }
      }
    }
  });

  it("不正な状態(NaN・負・最大距離 0)でも、落ちない(何も出さない)", () => {
    assert.doesNotThrow(() =>
      activeCues(all, at({ elapsed: Number.NaN, distance: Number.NaN }), 100),
    );
    assert.deepEqual(activeCues(all, at({ elapsed: -1 }), 100), []);
    assert.deepEqual(activeCues(rulesOf({ rules: [CLOSING] }), at({ distance: 0 }), 0), []);
  });
});

describe("合図の文字", () => {
  it("4 種類の文字がある(「!」で終わる短い文字)。知らない合図・__proto__ などは、空", () => {
    assert.deepEqual(
      CUE_ORDER.map((token) => cueLabel(token)),
      ["ダッシュ注意!", "ダッシュ中!", "ミスで加速中!", "追い詰め中!"],
    );
    for (const label of Object.values(CUE_LABELS)) assert.match(label, /^[^\s]{3,10}!$/);
    for (const bad of ["boom", "__proto__", "constructor", "toString", "", undefined, null, 5]) {
      assert.equal(cueLabel(bad), "", String(bad));
    }
    assert.deepEqual(Object.keys(CUE_LABELS).sort(), [...CUE_ORDER].sort());
    assert.ok(Object.isFrozen(CUE_LABELS) && Object.isFrozen(CUE_ORDER));
  });

  it("実際の役職: 先輩は、いつも合図なし。ほかは、ルールに応じた合図が、出うる", () => {
    const seen = {};
    for (const role of roles) {
      const rules = rulesOf(role.stage);
      seen[role.id] = new Set();
      for (let elapsed = 0; elapsed < 60; elapsed += 0.5) {
        for (const distance of [100, 40, 10]) {
          for (const shockUntil of [0, elapsed + 1]) {
            for (const cue of activeCues(
              rules,
              at({ elapsed, distance, shockUntil }),
              role.stage.max_distance,
            )) {
              seen[role.id].add(cue);
            }
          }
        }
      }
    }
    assert.deepEqual([...seen.senpai], []);
    assert.deepEqual([...seen.kakaricho].sort(), ["surge", "surge-warn"]);
    assert.deepEqual([...seen.buchou], ["shock"]);
    assert.deepEqual([...seen.shachou], ["closing"]);
    assert.deepEqual([...seen.kaicho].sort(), [...CUE_ORDER].sort());
  });
});

describe("画面(HTML・view.js)", () => {
  const html = read("public/games/escape-boss/index.html");
  const view = read("public/assets/js/games/escape-boss/view.js");

  it("ゲージの横に、合図の文字の欄(role=status)。「あぶない!」の次にある。追いかけ専用の部品の中(用語確認では隠れる)", () => {
    const block = html.slice(
      html.indexOf('<div class="gauge-block"'),
      html.indexOf('<div class="scene"'),
    );
    assert.match(block, /data-chase-only/);
    assert.match(block, /<span class="gauge__cues" role="status" data-rule-cues><\/span>/);
    assert.ok(block.indexOf("data-danger") < block.indexOf("data-rule-cues"));
  });

  it("場面(aria-hidden)の中に、速さの線と、頭の「!」がある。追ってくる人の絵の直後に「!」", () => {
    const scene = html.slice(
      html.indexOf('<div class="scene"'),
      html.indexOf('<div class="game-word">'),
    );
    assert.match(scene, /aria-hidden="true"/);
    assert.match(scene, /<div class="scene__speed" data-speed><\/div>/);
    assert.match(scene, /data-chaser\s*\/>\s*<span class="scene__alert" data-alert>!<\/span>/);
    // 既存の構造(位置の枠 → 動く絵)は、変わらない
    assert.match(scene, /<div class="scene__chaser">\s*<img\s+class="scene__chaser-img"/);
  });

  it("view.js: renderStats が、遊んでいる間だけ、ルールの合図を出す(終わったら消す)。文字は el()(textContent)だけ", () => {
    assert.match(view, /import \{[^}]*\bactiveCues\b[^}]*\} from "\.\/rules\.js";/);
    assert.match(
      view,
      /renderCues\(\s*state\.status === "playing"\s*\?\s*activeCues\(rulesOf\(stage\), state, stage\.max_distance\)\s*:\s*\[\],?\s*\);/,
    );
    assert.ok(!/innerHTML/.test(view));
    assert.match(view, /scene\.dataset\.cues = tokens\.join\(" "\);/);
  });

  it("画面が替わる・演出が始まるとき(clearStaging)、合図を消す。変わらない合図は、作り直さない(読み上げをくり返さない)", () => {
    assert.match(
      view,
      /function clearStaging\(\) \{\s*banner\.hidden = true;\s*renderCues\(\[\]\);/,
    );
    assert.match(view, /tokens\.every\(\(token, i\) => token === cues\[i\]\)\) return;/);
    assert.match(view, /if \(cueBox\.children\[index\] !== node\)\s*cueBox\.insertBefore/);
  });

  it("view.js が探す data- の目印は、HTML にある", () => {
    for (const mark of ["data-rule-cues"]) {
      assert.ok(view.includes(`[${mark}]`) && html.includes(mark), mark);
    }
  });
});

describe("CSS", () => {
  const css = read("public/assets/css/game.css");
  const scene = css.slice(
    css.indexOf("/* 追跡シーン"),
    css.indexOf("/* ダッシュボードのセクション */"),
  );

  it("合図の文字: 予告は破線、働いている間は実線(色だけに頼らない)。色はトークン", () => {
    assert.match(
      css,
      /\.gauge__cue \{[^}]*border: var\(--border-width\) dashed var\(--color-border\)/,
    );
    assert.match(
      css,
      /\.gauge__cue\[data-cue="surge"\],\s*\.gauge__cue\[data-cue="shock"\],\s*\.gauge__cue\[data-cue="closing"\] \{\s*border-style: solid;/,
    );
    const block = css.slice(css.indexOf(".gauge__cues {"), css.indexOf("/* 追跡シーン"));
    assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(block));
  });

  it("場面の見せ場: ダッシュ中・ミスで加速中は、速さの線と、追ってくる人が大きくなる。予告は「!」。追い詰め中は、少し大きくなる", () => {
    assert.match(
      scene,
      /\.scene\[data-cues~="surge"\] \.scene__speed,\s*\.scene\[data-cues~="shock"\] \.scene__speed \{\s*display: block;\s*animation: scene-speed/,
    );
    assert.match(
      scene,
      /\.scene\[data-cues~="surge-warn"\] \.scene__alert \{\s*display: block;\s*animation: scene-alert/,
    );
    assert.match(scene, /\.scene\[data-cues~="closing"\] \.scene__chaser-img \{\s*scale: 1\.06;/);
    assert.match(
      scene,
      /\.scene\[data-cues~="surge"\] \.scene__chaser-img,\s*\.scene\[data-cues~="shock"\] \.scene__chaser-img \{\s*scale: 1\.12;/,
    );
  });

  it("追ってくる人の大きさは、scale(動きの transform と重なる)で変える。動きの animation を、上書きしない", () => {
    const rules = scene.slice(
      scene.indexOf('.scene[data-cues~="closing"]'),
      scene.indexOf("/* 役職別の、終わりの演出"),
    );
    assert.ok(!/\banimation\b/.test(rules.slice(rules.indexOf('.scene[data-cues~="closing"]'))));
  });

  it("速さの線・「!」は、ちらつかない: 動くのは位置・大きさだけ(色・明るさ・影は変えない)", () => {
    const body = (name) =>
      new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?)\\n\\}\\n`).exec(scene)[1];
    for (const name of ["scene-speed", "scene-alert"]) {
      assert.ok(!/opacity|filter|box-shadow|background-color|color:/.test(body(name)), name);
    }
    assert.match(body("scene-speed"), /background-position/);
    assert.match(body("scene-alert"), /transform/);
  });

  it("速さの線は、場面の中で、追ってくる人より後ろ(HTML の順で、追ってくる人の前)。クリックを受けない", () => {
    const html = read("public/games/escape-boss/index.html");
    assert.ok(html.indexOf("data-speed") < html.indexOf('class="scene__chaser"'));
    assert.match(scene, /\.scene__speed \{[^}]*pointer-events: none;/);
  });

  it("動きを減らす設定でも、合図の文字と、静止した見せ場(線・「!」・大きさ)が残る(全体の規則がアニメーションだけを止める)", () => {
    const base = read("public/assets/css/base.css");
    assert.match(
      base,
      /prefers-reduced-motion: reduce[\s\S]*animation-duration: 0\.01ms !important/,
    );
    assert.ok(!/prefers-reduced-motion[^{]*\{[^}]*scene__speed/.test(scene));
  });
});

describe("main.js は、合図の計算に触れない(エンジンと view が、同じ状態から作る)", () => {
  it("合図は、view.renderStats(state, stage)だけが作る。main.js に、ルールの判断がない", () => {
    const main = read("public/assets/js/games/escape-boss/main.js");
    assert.ok(!/activeCues|surgePhase|closingMultiplier|drainMultiplier/.test(main));
  });
});
