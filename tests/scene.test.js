// 追跡シーン(Phase 15 PR 1)のテスト: 純粋なロジック(scene.js)・役職の動きのデータ・画面の構造・CSS。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DANGER_RATIO,
  DEFAULT_MOTION,
  EVENT_MS,
  SCENE_EVENTS,
  SCENE_MOTIONS,
  closenessOf,
  isDanger,
  motionOf,
} from "../public/assets/js/games/escape-boss/scene.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const roles = JSON.parse(read("public/data/roles.json"));

describe("位置(closenessOf)", () => {
  it("距離が最大で 0(遠い)、0 で 1(すぐ後ろ)。範囲の外は、範囲に収める", () => {
    assert.equal(closenessOf(100, 100), 0);
    assert.equal(closenessOf(0, 100), 1);
    assert.equal(closenessOf(50, 100), 0.5);
    assert.equal(closenessOf(-10, 100), 1);
    assert.equal(closenessOf(150, 100), 0);
  });
});

describe("危ないか(isDanger)", () => {
  it("距離が最大の 25% 以下で、危ない(ちょうど 25% も、危ない)", () => {
    assert.equal(DANGER_RATIO, 0.25);
    assert.equal(isDanger(25, 100), true);
    assert.equal(isDanger(0, 100), true);
    assert.equal(isDanger(-5, 100), true);
    assert.equal(isDanger(25.01, 100), false);
    assert.equal(isDanger(100, 100), false);
    assert.equal(isDanger(60, 100), false);
  });

  it("最大距離が違っても、割合で判断する", () => {
    assert.equal(isDanger(12.5, 50), true);
    assert.equal(isDanger(13, 50), false);
  });

  it("ゲージ(view.js)と場面が、同じ判断(isDanger)を使う", () => {
    const view = read("public/assets/js/games/escape-boss/view.js");
    assert.match(view, /const danger = isDanger\(state\.distance, stage\.max_distance\);/);
    assert.match(view, /gauge\.classList\.toggle\("is-danger", danger\);/);
    assert.match(view, /scene\.classList\.toggle\("is-danger", danger\);/);
    assert.ok(!view.includes("ratio <= 0.25"));
  });
});

describe("役職の動き(motionOf・roles.json)", () => {
  it("動きは 5 種類: 走る・こぐ・振動と煙・滑らか・オーラ", () => {
    assert.deepEqual([...SCENE_MOTIONS], ["run", "pedal", "drive", "glide", "aura"]);
    assert.equal(DEFAULT_MOTION, "run");
  });

  it("5 役職すべてが、動きを持ち、役職ごとに違う(先輩 = run … 会長 = aura)", () => {
    assert.deepEqual(
      roles.map((role) => [role.id, role.scene?.motion]),
      [
        ["senpai", "run"],
        ["kakaricho", "pedal"],
        ["buchou", "drive"],
        ["shachou", "glide"],
        ["kaicho", "aura"],
      ],
    );
    for (const role of roles) assert.ok(SCENE_MOTIONS.includes(role.scene.motion), role.id);
    assert.equal(new Set(roles.map((role) => role.scene.motion)).size, roles.length);
  });

  it("知らない値・ない場合・壊れた役職は、既定(run)。落ちない", () => {
    for (const role of [
      undefined,
      null,
      {},
      { scene: null },
      { scene: {} },
      { scene: { motion: "fly" } },
      { scene: { motion: "__proto__" } },
      { scene: { motion: 5 } },
      { scene: { motion: ["run"] } },
    ]) {
      assert.equal(motionOf(role), DEFAULT_MOTION, JSON.stringify(role));
    }
    assert.equal(motionOf({ scene: { motion: "aura" } }), "aura");
  });

  it("役職の絵・乗り物・動きが、そろっている(絵のファイルが存在する)", () => {
    for (const role of roles) {
      assert.ok(role.vehicle && role.image && role.scene, role.id);
      assert.doesNotThrow(() => read(`public${role.image}`), role.id);
    }
  });
});

describe("一瞬の演出", () => {
  it("miss(ミスで飛び出す)と gain(正解で引き離す)。350ms で戻る", () => {
    assert.deepEqual([...SCENE_EVENTS], ["miss", "gain"]);
    assert.equal(EVENT_MS, 350);
  });
});

describe("画面の構造(HTML)", () => {
  const html = read("public/games/escape-boss/index.html");
  const play = html.slice(html.indexOf('data-view="play"'), html.indexOf('data-view="result"'));

  it("上から、距離ゲージ → 場面 → 単語 → 入力欄。サイドステータスは、その後ろ(横)", () => {
    const order = [
      "gauge-block",
      'class="scene"',
      "game-word",
      "game-input",
      "game-play__side",
    ].map((name) => play.indexOf(name));
    assert.ok(
      order.every((index) => index > 0),
      order.join(),
    );
    assert.deepEqual(
      [...order].sort((a, b) => a - b),
      order,
    );
  });

  it("場面は、飾り(aria-hidden)。既定の動き(run)を持つ。追ってくる人は、位置の枠と、動く絵に分かれている", () => {
    assert.match(
      play,
      /<div class="scene" aria-hidden="true" data-scene data-motion="run" data-chase-only>/,
    );
    assert.match(
      play,
      /<div class="scene__chaser">\s*<img\s+class="scene__chaser-img"[^>]*data-chaser/,
    );
    assert.match(play, /class="scene__player"/);
    // 絵に、大きさの指定(レイアウトのずれの防止)と、空の alt(装飾)がある
    for (const image of play.match(/<img[\s\S]*?>/g) ?? []) {
      assert.match(image, /alt=""/);
      assert.match(image, /width="\d+"/);
      assert.match(image, /height="\d+"/);
    }
  });

  it("ゲージは、読み上げられる(progressbar・ラベル)。距離の値は、更新される", () => {
    assert.match(play, /role="progressbar"/);
    assert.match(play, /aria-label="逃走距離"/);
  });
});

describe("CSS", () => {
  const css = read("public/assets/css/game.css");
  const base = read("public/assets/css/base.css");
  const scene = css.slice(
    css.indexOf("/* 追跡シーン"),
    css.indexOf("/* ダッシュボードのセクション */"),
  );

  it("役職の動き(5 種類)・一瞬の演出(2 種類)・危ないときの見た目が、CSS にある", () => {
    for (const motion of SCENE_MOTIONS) {
      assert.ok(scene.includes(`.scene[data-motion="${motion}"] .scene__chaser-img`), motion);
    }
    for (const event of SCENE_EVENTS) assert.ok(scene.includes(`[data-event="${event}"]`), event);
    assert.ok(scene.includes(".scene.is-danger"));
  });

  it("アニメーションの名前は、すべて @keyframes が定義されている(未定義の名前を使わない)", () => {
    const defined = new Set([...css.matchAll(/@keyframes ([a-z0-9-]+)/g)].map((match) => match[1]));
    const used = new Set();
    for (const match of css.matchAll(/animation(?:-name)?:\s*([^;]+);/g)) {
      for (const word of match[1].split(/[\s,]+/)) if (word.startsWith("scene-")) used.add(word);
    }
    assert.ok(used.size >= 12, `使っているアニメーションを、拾えていません(${used.size})`);
    for (const name of used) assert.ok(defined.has(name), `${name}: @keyframes がありません`);
    // 定義しただけで、使っていないものも、ない
    for (const name of defined)
      if (name.startsWith("scene-")) assert.ok(used.has(name), `${name}: 使われていません`);
  });

  it("色・明るさ・影を変えるアニメーションは、ゆっくり(1 周 0.8 秒以上)。ちらつかせない", () => {
    const bodies = new Map(
      [...css.matchAll(/@keyframes ([a-z0-9-]+)\s*\{([\s\S]*?)\n\}\n/g)].map((match) => [
        match[1],
        match[2],
      ]),
    );
    let checked = 0;
    for (const match of scene.matchAll(/animation:\s*([^;]+);/g)) {
      for (const part of match[1].split(",")) {
        const name = part.trim().split(/\s+/)[0];
        const duration = /(\d*\.?\d+)s/.exec(part)?.[1];
        const body = bodies.get(name) ?? "";
        if (!/opacity|filter|box-shadow|background(?!-position)/.test(body)) continue;
        checked += 1;
        assert.ok(Number(duration) >= 0.8, `${name}: ${duration}s は、速すぎます`);
      }
    }
    assert.ok(checked >= 4, `検査した数: ${checked}`);
  });

  it("動きを減らす設定で、アニメーションは止まる(全体の規則)。動く飾り(煙)は、消す。位置は、CSS 変数で残る", () => {
    assert.match(
      base,
      /prefers-reduced-motion: reduce[\s\S]*animation-duration: 0\.01ms !important/,
    );
    assert.match(
      scene,
      /prefers-reduced-motion: reduce[\s\S]*data-motion="drive"[\s\S]*display: none/,
    );
    assert.match(scene, /left: calc\(\(100% - 6rem - 3\.2rem - 1rem\) \* var\(--closeness\)\)/);
  });

  it("場面の色は、トークンで指定する(色の直書きなし)", () => {
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(scene));
  });

  it("危ないときの縁は、動かなくても残る(色だけでなく、太さ 0.25rem の縁)", () => {
    const rule = scene.slice(
      scene.indexOf(".scene.is-danger {"),
      scene.indexOf("}", scene.indexOf(".scene.is-danger {")),
    );
    assert.match(rule, /box-shadow: inset 0 0 0 0\.25rem var\(--color-accent\)/);
  });
});

describe("main.js・view.js のつなぎ", () => {
  const main = read("public/assets/js/games/escape-boss/main.js");
  const view = read("public/assets/js/games/escape-boss/view.js");

  it("ミスで miss、正解で gain の演出を出す。用語確認(場面がない)では、出さない", () => {
    assert.match(main, /view\.flashMiss\(\);\s*view\.pulseScene\("miss"\);/);
    assert.match(main, /view\.pulseScene\("gain"\);/);
    const check = main.slice(
      main.indexOf("function handleCheckChar"),
      main.indexOf("// 用語確認では、語が変わるたびに"),
    );
    assert.ok(!check.includes("pulseScene"));
  });

  it("開始で、役職の動きを場面に付け、危ない・演出を、リセットする。演出は、決まった名前だけ", () => {
    assert.match(view, /scene\.dataset\.motion = motionOf\(role\);/);
    assert.match(view, /scene\.classList\.remove\("is-danger"\);/);
    assert.match(view, /if \(!SCENE_EVENTS\.includes\(kind\)\) return;/);
    assert.match(view, /setTimeout\([\s\S]*EVENT_MS\)/);
  });

  it("scene.js は、DOM・時計・保存に触れない(純粋なロジック)", () => {
    const code = read("public/assets/js/games/escape-boss/scene.js").replace(/\/\/.*$/gm, "");
    assert.ok(!/document|window|performance|Date\.now|localStorage|setTimeout/.test(code));
  });
});
