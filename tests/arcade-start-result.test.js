// アーケード風の開始画面の点滅・結果画面のドラムロール(Issue #166 PR 2)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createRoll, ROLL_MS, rollValue } from "../public/assets/js/games/escape-boss/countup.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const css = read("public/assets/css/game.css");
const html = read("public/games/escape-boss/index.html");
const view = read("public/assets/js/games/escape-boss/view.js");
const main = read("public/assets/js/games/escape-boss/main.js");

function fakeClock() {
  let time = 0;
  let next = 1;
  const queue = new Map();
  return {
    now: () => time,
    request: (fn) => {
      const id = next++;
      queue.set(id, fn);
      return id;
    },
    cancel: (id) => queue.delete(id),
    advance(ms) {
      time += ms;
      const run = [...queue.values()];
      queue.clear();
      for (const fn of run) fn();
    },
    pending: () => queue.size,
  };
}

describe("rollValue", () => {
  it("0 から始まり、終わりでちょうど目標の値になる。途中は増えるだけ", () => {
    assert.equal(rollValue(1234, 0), 0);
    assert.equal(rollValue(1234, ROLL_MS), 1234);
    assert.equal(rollValue(1234, ROLL_MS * 5), 1234);
    let prev = -1;
    for (let t = 0; t <= ROLL_MS; t += 50) {
      const v = rollValue(1234, t);
      assert.ok(v >= prev && v <= 1234);
      prev = v;
    }
  });

  it("壊れた値は、落ちずに 0(または目標)になる", () => {
    assert.equal(rollValue(Number.NaN, 100), 0);
    assert.equal(rollValue(-5, 100), 0);
    assert.equal(rollValue(100, Number.NaN), 100);
    assert.equal(rollValue(100, 10, 0), 100);
  });
});

describe("createRoll", () => {
  it("最初は 0、進むと増え、終わりに最後の値と onDone(1 回)", () => {
    const clock = fakeClock();
    const roll = createRoll(clock);
    const values = [];
    let done = 0;
    roll.start(500, { onFrame: (v) => values.push(v), onDone: () => done++ });
    assert.deepEqual(values, [0]);
    assert.ok(roll.isRunning());
    clock.advance(400);
    assert.ok(values.at(-1) > 0 && values.at(-1) < 500);
    clock.advance(ROLL_MS);
    assert.equal(values.at(-1), 500);
    assert.equal(done, 1);
    assert.ok(!roll.isRunning());
    assert.equal(clock.pending(), 0);
  });

  it("skip() は、すぐ最後の値にして、onDone は 1 回だけ", () => {
    const clock = fakeClock();
    const roll = createRoll(clock);
    const values = [];
    let done = 0;
    roll.start(777, { onFrame: (v) => values.push(v), onDone: () => done++ });
    roll.skip();
    roll.skip();
    assert.equal(values.at(-1), 777);
    assert.equal(done, 1);
    clock.advance(ROLL_MS * 2);
    assert.equal(done, 1);
    assert.equal(clock.pending(), 0);
  });

  it("cancel() は、何も呼ばずに止まる。start のやり直しで、前の数え方は消える", () => {
    const clock = fakeClock();
    const roll = createRoll(clock);
    let done = 0;
    roll.start(100, { onFrame: () => {}, onDone: () => done++ });
    roll.cancel();
    assert.ok(!roll.isRunning());
    clock.advance(ROLL_MS * 2);
    assert.equal(done, 0);

    const seen = [];
    roll.start(100, { onFrame: () => seen.push("a"), onDone: () => done++ });
    roll.start(200, { onFrame: (v) => seen.push(v), onDone: () => done++ });
    clock.advance(ROLL_MS * 2);
    assert.equal(seen.at(-1), 200);
    assert.equal(done, 1);
  });
});

describe("結果画面・開始画面の配線", () => {
  it("結果の画面に、RESULT の飾り(読み上げない)と、数え上げの表示欄がある。本当のスコアも残る", () => {
    const start = html.indexOf('data-view="result"');
    const end = html.indexOf('data-view="check-result"', start);
    const section = html.slice(start, end);
    assert.match(section, /game-result__label"\s+aria-hidden="true"/);
    assert.match(section, /data-result-roll/);
    assert.match(section, /result-score__roll"[^>]*aria-hidden="true"/);
    assert.match(section, /<strong data-result-score>/);
  });

  it("開始の点滅の文は、飾り(aria-hidden)。日本語の案内は、そのまま残る", () => {
    assert.match(html, /game-ready__press"\s+aria-hidden="true">PRESS SPACE KEY TO START</);
    assert.ok(html.includes("data-ready-start"));
  });

  it("点滅は 1 周 0.8 秒以上で、定義があり、100% の状態が見える(動きを減らす設定で、見えたまま)", () => {
    const m = /animation:\s*ready-blink\s+([\d.]+)s/.exec(css);
    assert.ok(m, "ready-blink の指定がない");
    assert.ok(Number(m[1]) >= 0.8);
    const at = css.indexOf("@keyframes ready-blink");
    assert.ok(at > 0);
    const block = css.slice(at, css.indexOf("\n}\n", at));
    assert.match(block, /100%\s*\{\s*opacity: 1/);
  });

  it("開始前の画面(.game-setup)も、暗い枠。見出し(STAGE SELECT)は飾りで、選択欄は読める色のまま(Issue #173)", () => {
    assert.match(
      html,
      /<form class="game-setup" data-setup>\s*<p class="game-setup__banner" aria-hidden="true">STAGE SELECT<\/p>/,
    );
    assert.match(css, /\.game-setup__banner\s*\{[^}]*font-family: var\(--font-display\)/);
  });

  it("結果の画面も、暗い枠(.game-play と同じトークン)。数え上げの欄は、hidden で消える", () => {
    assert.match(css, /\.game-result,\s*\.game-play,\s*\.game-setup\s*\{/);
    assert.match(css, /\.result-score__roll\[hidden\]\s*\{\s*display: none/);
  });

  it("view.js: 動きを減らす設定では数えない(prefersReducedMotion)。結果の画面を離れるとき止める", () => {
    assert.match(
      view,
      /import \{ prefersReducedMotion \} from "\.\.\/\.\.\/components\/motion\.js"/,
    );
    assert.match(view, /if \(prefersReducedMotion\(\)\)/);
    assert.ok(!/matchMedia/.test(view));
    assert.match(view, /clearStaging\(\);\s*stopRoll\(\);/);
  });

  it("main.js が、飛ばす操作(bindRollSkip)を結ぶ", () => {
    assert.match(main, /view\.bindRollSkip\(\)/);
    assert.match(view, /bindRollSkip\(\)/);
  });
});
