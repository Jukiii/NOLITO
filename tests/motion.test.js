// アニメーション軽減のサイト内切替(Phase 21 PR2)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MOTION,
  MOTION_KEY,
  MOTIONS,
  applyMotion,
  isMotion,
  loadMotion,
  prefersReducedMotion,
  saveMotion,
} from "../public/assets/js/components/motion.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

// 偽の localStorage(node:test には DOM がないため)
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    data,
  };
}

describe("motion.js(保存・読み込み・反映)", () => {
  it("MOTION_KEY・MOTIONS・DEFAULT_MOTION。「常に動かす」は選べない(2つだけ)", () => {
    assert.equal(MOTION_KEY, "nolito:motion:v1");
    assert.deepEqual(MOTIONS, ["system", "reduce"]);
    assert.equal(DEFAULT_MOTION, "system");
  });

  it("isMotion: 2つの値だけ true", () => {
    assert.equal(isMotion("system"), true);
    assert.equal(isMotion("reduce"), true);
    for (const bad of ["System", "always", "", null, undefined, 1]) {
      assert.equal(isMotion(bad), false);
    }
  });

  it("loadMotion: 保存されていれば、その値。なければ・不正なら、既定(システム)", () => {
    assert.equal(loadMotion(fakeStorage({ [MOTION_KEY]: "reduce" })), "reduce");
    assert.equal(loadMotion(fakeStorage({})), "system");
    assert.equal(loadMotion(fakeStorage({ [MOTION_KEY]: "always" })), "system");
    assert.equal(loadMotion(null), "system");
  });

  it("saveMotion: 正しい値だけ保存し、true を返す。不正な値は保存せず false", () => {
    const storage = fakeStorage();
    assert.equal(saveMotion("reduce", storage), true);
    assert.equal(storage.data[MOTION_KEY], "reduce");
    assert.equal(saveMotion("always", storage), false);
    assert.equal(saveMotion("reduce", null), false); // 保存先がなくても、落ちない
  });

  it("saveMotion: 保存に失敗しても(例外)、落ちない(false を返す)", () => {
    const throwing = {
      setItem: () => {
        throw new Error("quota");
      },
    };
    assert.equal(saveMotion("reduce", throwing), false);
  });

  it("applyMotion: root の data-reduced-motion に反映する。システムは属性を外す。不正な値は既定(システム)扱い", () => {
    const fakeRoot = { dataset: {} };
    applyMotion("reduce", fakeRoot);
    assert.equal(fakeRoot.dataset.reducedMotion, "reduce");
    applyMotion("system", fakeRoot);
    assert.equal("reducedMotion" in fakeRoot.dataset, false);
    applyMotion("reduce", fakeRoot);
    applyMotion("bogus", fakeRoot); // 不正な値も、既定(属性なし)として扱う
    assert.equal("reducedMotion" in fakeRoot.dataset, false);
  });

  it("prefersReducedMotion: サイト設定が reduce なら true。システムなら、OS(matchMedia)の判定による", () => {
    const reducedRoot = { dataset: { reducedMotion: "reduce" } };
    const systemRoot = { dataset: {} };
    const withMatchMedia = (matches) => {
      const original = globalThis.matchMedia;
      globalThis.matchMedia = () => ({ matches });
      return () => {
        globalThis.matchMedia = original;
      };
    };

    let restore = withMatchMedia(false);
    assert.equal(prefersReducedMotion(reducedRoot), true); // サイト設定が優先(ORの上乗せ)
    assert.equal(prefersReducedMotion(systemRoot), false);
    restore();

    restore = withMatchMedia(true);
    assert.equal(prefersReducedMotion(systemRoot), true); // OSがreduceなら、サイト設定がsystemでもtrue
    restore();
  });

  it("prefersReducedMotion: matchMedia が使えない環境でも、落ちない(OS側はfalse扱い)", () => {
    const original = globalThis.matchMedia;
    globalThis.matchMedia = undefined;
    assert.equal(prefersReducedMotion({ dataset: {} }), false);
    globalThis.matchMedia = () => {
      throw new Error("boom");
    };
    assert.equal(prefersReducedMotion({ dataset: {} }), false);
    globalThis.matchMedia = original;
  });
});

describe("ページの静的な性質", () => {
  const motionJs = read("public/assets/js/components/motion.js");
  const footerJs = read("public/assets/js/components/footer.js");
  const mainJs = read("public/assets/js/main.js");
  const baseCss = read("public/assets/css/base.css");
  const gameCss = read("public/assets/css/game.css");
  const gameMainJs = read("public/assets/js/games/escape-boss/main.js");

  it("フッターに、アニメーションの select がある(main.js から初期化される)", () => {
    assert.match(footerJs, /data-motion-select/);
    assert.match(mainJs, /data-motion-select/);
    assert.match(mainJs, /initMotion\(/);
  });

  it("選択肢は system・reduce の2つだけ(「常に動かす」の選択肢はない)", () => {
    assert.match(footerJs, /value:\s*"system"/);
    assert.match(footerJs, /value:\s*"reduce"/);
    assert.ok(!/value:\s*"(always|force|full)"/.test(footerJs));
  });

  it("base.css: OSの設定(prefers-reduced-motion)と、サイト内切替(data-reduced-motion)の、両方に同じ抑制ルールがある", () => {
    assert.match(baseCss, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(baseCss, /:root\[data-reduced-motion="reduce"\] \*/);
    assert.match(baseCss, /animation-duration: 0\.01ms !important/);
  });

  it("game.css: 場面の飾り(煙)の抑制も、OS設定・サイト内切替の両方に対応している", () => {
    assert.match(gameCss, /:root\[data-reduced-motion="reduce"\] \.scene\[data-motion="drive"\]/);
  });

  it("ゲームの main.js は、直接 matchMedia を呼ばず、prefersReducedMotion() を使う(サイト設定も反映するため)", () => {
    assert.match(
      gameMainJs,
      /import \{ prefersReducedMotion \} from "\.\.\/\.\.\/components\/motion\.js";/,
    );
    assert.ok(!/matchMedia\(/.test(gameMainJs));
  });

  it("HTML として解釈する書き方をしない(innerHTML等を使わない)。外部へ通信しない", () => {
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(motionJs));
    assert.ok(!/https?:\/\//.test(motionJs));
  });
});
