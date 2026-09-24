// 開始・終わりの演出(Phase 16 PR 2)のテスト: 進行(純粋なロジック)と、画面・main.js のつなぎ。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  INTRO_STEPS,
  INTRO_STEPS_REDUCED,
  OUTRO_MS,
  OUTRO_MS_REDUCED,
  createTimeline,
  introSteps,
  isSkipKey,
  outroSteps,
} from "../public/assets/js/games/escape-boss/staging.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

// 偽のタイマー(時間を、テストが進める)
function fakeTimers() {
  let now = 0;
  let nextId = 1;
  const queue = new Map();
  return {
    setTimer(fn, ms) {
      const id = nextId++;
      queue.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimer(id) {
      queue.delete(id);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = [...queue.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        queue.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = target;
    },
    get pending() {
      return queue.size;
    },
  };
}

describe("演出の段階", () => {
  it("開始は「よーい…」→「スタート!」。動きを減らす設定では、短く「スタート!」だけ", () => {
    assert.deepEqual(
      INTRO_STEPS.map((step) => step.text),
      ["よーい…", "スタート!"],
    );
    assert.deepEqual(
      INTRO_STEPS_REDUCED.map((step) => step.text),
      ["スタート!"],
    );
    assert.equal(introSteps(false), INTRO_STEPS);
    assert.equal(introSteps(true), INTRO_STEPS_REDUCED);
    const total = (steps) => steps.reduce((sum, step) => sum + step.ms, 0);
    // 開始の演出は、約 1.5 秒(飛ばせるので、繰り返しでも邪魔にならない)
    assert.equal(total(INTRO_STEPS), 1500);
    assert.ok(total(INTRO_STEPS_REDUCED) <= total(INTRO_STEPS));
  });

  it("終わりは、クリア・ゲームオーバーで文字が違い、長さは同じ(約 1.2 秒。減らす設定では短い)", () => {
    const clear = outroSteps("cleared");
    const over = outroSteps("gameover");
    assert.deepEqual([clear[0].id, clear[0].text, clear[0].ms], ["clear", "逃げ切った!", OUTRO_MS]);
    assert.deepEqual([over[0].id, over[0].text, over[0].ms], ["over", "つかまった…", OUTRO_MS]);
    assert.equal(OUTRO_MS, 1200);
    assert.ok(OUTRO_MS_REDUCED < OUTRO_MS);
    assert.equal(outroSteps("cleared", true)[0].ms, OUTRO_MS_REDUCED);
    // 終わっていない状態・不明な状態には、終わりの演出はない
    assert.equal(outroSteps("playing"), null);
    assert.equal(outroSteps(undefined), null);
  });

  it("段階の定義は、書き換えられない", () => {
    assert.ok(Object.isFrozen(INTRO_STEPS) && Object.isFrozen(INTRO_STEPS[0]));
    assert.ok(Object.isFrozen(INTRO_STEPS_REDUCED));
    assert.ok(Object.isFrozen(outroSteps("cleared")[0]));
  });
});

describe("演出を飛ばすキー", () => {
  it("Enter・スペース・Esc だけ。文字・Tab・矢印では、飛ばさない", () => {
    for (const key of ["Enter", " ", "Escape"]) assert.equal(isSkipKey(key), true, key);
    for (const key of ["a", "Z", "1", "Tab", "ArrowDown", "Shift", "Backspace", "", undefined]) {
      assert.equal(isSkipKey(key), false, String(key));
    }
  });
});

describe("createTimeline(演出の進行)", () => {
  const steps = [
    { id: "a", ms: 900 },
    { id: "b", ms: 600 },
  ];

  it("段階が順に進み、最後まで進むと、onDone が 1 回だけ呼ばれる", () => {
    const timers = fakeTimers();
    const log = [];
    const timeline = createTimeline(steps, {
      onStep: (step, index) => log.push(`step:${step.id}:${index}`),
      onDone: () => log.push("done"),
      ...timers,
    });
    assert.equal(timeline.active, false);
    timeline.start();
    assert.equal(timeline.active, true);
    assert.deepEqual(log, ["step:a:0"]);
    timers.advance(899);
    assert.deepEqual(log, ["step:a:0"]);
    timers.advance(1);
    assert.deepEqual(log, ["step:a:0", "step:b:1"]);
    timers.advance(599);
    assert.equal(timeline.active, true);
    timers.advance(1);
    assert.deepEqual(log, ["step:a:0", "step:b:1", "done"]);
    assert.equal(timeline.active, false);
    timers.advance(10_000);
    assert.equal(log.filter((entry) => entry === "done").length, 1);
    assert.equal(timers.pending, 0);
  });

  it("飛ばすと、すぐ終わる(onDone は 1 回だけ)。あとから、タイマーが動かない", () => {
    const timers = fakeTimers();
    const log = [];
    const timeline = createTimeline(steps, {
      onStep: (step) => log.push(step.id),
      onDone: () => log.push("done"),
      ...timers,
    });
    timeline.start();
    timers.advance(100);
    timeline.skip();
    assert.deepEqual(log, ["a", "done"]);
    assert.equal(timeline.active, false);
    timeline.skip(); // 2 回目は、何もしない
    timers.advance(10_000);
    assert.deepEqual(log, ["a", "done"]);
    assert.equal(timers.pending, 0);
  });

  it("2 つ目の段階で飛ばしても、onDone は 1 回", () => {
    const timers = fakeTimers();
    let done = 0;
    const timeline = createTimeline(steps, { onDone: () => (done += 1), ...timers });
    timeline.start();
    timers.advance(900);
    timeline.skip();
    timers.advance(10_000);
    assert.equal(done, 1);
  });

  it("cancel は、onDone を呼ばずに止める。始める前・終わったあとの skip・cancel は、何もしない", () => {
    const timers = fakeTimers();
    let done = 0;
    const timeline = createTimeline(steps, { onDone: () => (done += 1), ...timers });
    timeline.skip();
    timeline.cancel();
    timeline.start();
    timers.advance(300);
    timeline.cancel();
    timers.advance(10_000);
    assert.equal(done, 0);
    assert.equal(timeline.active, false);
    assert.equal(timers.pending, 0);
    timeline.skip();
    assert.equal(done, 0);
  });

  it("進行中の start は、無視される(二重に始まらない)。終わったあとは、もう一度始められる", () => {
    const timers = fakeTimers();
    const log = [];
    const timeline = createTimeline([{ id: "x", ms: 10 }], {
      onStep: (step) => log.push(step.id),
      onDone: () => log.push("done"),
      ...timers,
    });
    timeline.start();
    timeline.start();
    assert.deepEqual(log, ["x"]);
    timers.advance(10);
    timeline.start();
    timers.advance(10);
    assert.deepEqual(log, ["x", "done", "x", "done"]);
  });

  it("onDone の中で、次の演出を始めても、壊れない", () => {
    const timers = fakeTimers();
    const log = [];
    let second;
    const first = createTimeline([{ id: "one", ms: 5 }], {
      onDone: () => {
        log.push("first-done");
        second.start();
      },
      ...timers,
    });
    second = createTimeline([{ id: "two", ms: 5 }], {
      onStep: (step) => log.push(step.id),
      onDone: () => log.push("second-done"),
      ...timers,
    });
    first.start();
    timers.advance(10);
    assert.deepEqual(log, ["first-done", "two", "second-done"]);
  });

  it("段階が空・ms が不正(負・数でない)だと、作れない", () => {
    assert.throws(() => createTimeline([]), TypeError);
    assert.throws(() => createTimeline(null), TypeError);
    assert.throws(() => createTimeline([{ id: "a", ms: -1 }]), TypeError);
    assert.throws(() => createTimeline([{ id: "a", ms: Number.NaN }]), TypeError);
    assert.throws(() => createTimeline([{ id: "a" }]), TypeError);
  });
});

describe("staging.js は、DOM・保存・時計に触れない", () => {
  it("document・window・storage・performance・Date を、使わない(タイマーは、引数で受け取る)", () => {
    const source = read("public/assets/js/games/escape-boss/staging.js");
    assert.ok(
      !/\b(document|window|localStorage|sessionStorage|performance|Date|fetch)\b/.test(source),
    );
  });
});

describe("main.js のつなぎ", () => {
  const main = read("public/assets/js/games/escape-boss/main.js");

  it("ゲームは、開始の演出のあとに、時間が進み始める(beginGame は、フレームを、直接始めない)", () => {
    const begin = main.slice(
      main.indexOf("async function beginGame"),
      main.indexOf("function beginIntro"),
    );
    assert.match(begin, /phase: "intro"/);
    assert.match(begin, /beginIntro\(\);/);
    assert.ok(!begin.includes("requestAnimationFrame"));
    const start = main.slice(
      main.indexOf("function startPlaying"),
      main.indexOf("function frame("),
    );
    assert.match(start, /session\.phase = "play";/);
    assert.match(start, /session\.lastFrame = performance\.now\(\);/);
    assert.match(start, /requestAnimationFrame\(frame\)/);
  });

  it("演出の間(intro・outro)は、入力を受け付けない。タブの切り替えでも、時間を動かさない", () => {
    assert.match(main, /session\.phase !== "play"\) return;/);
    assert.match(main, /if \(session\.phase !== "play"\) return; \/\/ 演出の間は/);
  });

  it("結果は、終わりの演出の前に保存する。結果の画面は、演出が終わってから(飛ばしても 1 回だけ)出す", () => {
    const finish = main.slice(
      main.indexOf("function finish()"),
      main.indexOf("function handleChar"),
    );
    assert.ok(finish.indexOf("store.update(") < finish.indexOf("beginOutro("));
    // 結果の画面を出すのは、演出の onDone の中だけ
    assert.equal(main.match(/view\.showResult\(/g).length, 1);
    const outro = finish.slice(finish.indexOf("function beginOutro"));
    assert.match(outro, /onDone: \(\) => \{[\s\S]*view\.showResult\(/);
    assert.match(outro, /if \(session !== current\) return;/);
  });

  it("やめる・新しいゲーム・用語確認の開始では、進行中の演出を止める", () => {
    const quit = main.slice(main.indexOf("function quit()"));
    assert.match(quit, /^function quit\(\) \{\s*stopTimeline\(\);/);
    assert.match(main, /function startCheckSession[\s\S]*?stopTimeline\(\);/);
    assert.match(main, /前のゲームの処理が残っていれば[\s\S]*?stopTimeline\(\);/);
  });

  it("演出は、動きを減らす設定(OS・サイト内切替のどちらも)を見て、短くする。飛ばす操作は、view から受け取る", () => {
    // Phase 21 PR2: OSの設定は components/motion.js の prefersReducedMotion() 経由(サイト内切替と、まとめて判定)
    assert.match(
      main,
      /import \{ prefersReducedMotion \} from "\.\.\/\.\.\/components\/motion\.js";/,
    );
    assert.match(main, /const reducedMotion = \(\) => prefersReducedMotion\(\);/);
    assert.match(main, /introSteps\(reducedMotion\(\)\)/);
    assert.match(main, /outroSteps\(session\.state\.status, reducedMotion\(\)\)/);
    assert.match(main, /view\.bindSkip\(\(\) => timeline\?\.skip\(\)\);/);
  });

  it("用語確認には、演出・セリフがない(startCheckSession に、演出の呼び出しがない)", () => {
    const check = main.slice(
      main.indexOf("function startCheckSession"),
      main.indexOf("function announceWord"),
    );
    assert.ok(!/beginIntro|beginOutro|say\(|showBubble|showStaging/.test(check));
  });
});

describe("画面(HTML・view.js・CSS)", () => {
  const html = read("public/games/escape-boss/index.html");
  const view = read("public/assets/js/games/escape-boss/view.js");
  const css = read("public/assets/css/game.css");

  it("バナー・吹き出し・紙吹雪は、場面(aria-hidden)の中にある。最初は隠れている", () => {
    const scene = html.slice(
      html.indexOf('<div class="scene"'),
      html.indexOf('<div class="game-word">'),
    );
    for (const mark of ["data-banner", "data-bubble", "data-confetti"]) {
      assert.ok(scene.includes(mark), mark);
    }
    assert.match(scene, /<p class="scene__bubble" data-bubble hidden>/);
    assert.match(scene, /<div class="scene__banner" data-banner hidden>/);
    assert.match(html, /<p class="result__quote" lang="ja" data-result-quote hidden><\/p>/);
  });

  it("view.js が探す data- の目印は、HTML にある", () => {
    for (const mark of [
      "data-banner",
      "data-banner-text",
      "data-bubble",
      "data-bubble-name",
      "data-bubble-text",
      "data-result-quote",
    ]) {
      assert.ok(view.includes(`[${mark}]`), `view.js: ${mark}`);
      assert.ok(html.includes(mark), `HTML: ${mark}`);
    }
  });

  it("飛ばす操作は、演出を出している間だけ効く。ボタン・リンク・選択欄のキーは奪わない。文字のキーでは飛ばさない", () => {
    const skip = view.slice(view.indexOf("bindSkip("), view.indexOf("// 追ってくる人の吹き出し"));
    assert.match(skip, /if \(!staging\(\) \|\| !isSkipKey\(event\.key\)\) return;/);
    assert.match(skip, /event\.target !== input && event\.target !== document\.body/);
    assert.match(skip, /scene\.addEventListener\("click"/);
  });

  it("文字は textContent だけで入れる。画面が替わると、演出・吹き出しは消える", () => {
    assert.ok(!/innerHTML|insertAdjacentHTML/.test(view));
    assert.match(view, /function showView\(name\) \{\s*clearStaging\(\);/);
    assert.match(view, /\$\("\[data-banner-text\]"\)\.textContent = text;/);
    assert.match(view, /\$\("\[data-bubble-text\]"\)\.textContent = text;/);
  });

  it("CSS: 終わりの演出(clear・over)と、バナー・吹き出しの hidden。色はトークン", () => {
    for (const rule of [
      '.scene[data-stage="clear"] .scene__chaser',
      '.scene[data-stage="clear"] .scene__player',
      '.scene[data-stage="clear"] .scene__confetti',
      '.scene[data-stage="over"] .scene__chaser',
      '.scene[data-stage="over"] .scene__player',
      ".scene__bubble[hidden]",
      ".scene__banner[hidden]",
    ]) {
      assert.ok(css.includes(rule), rule);
    }
    const block = css.slice(
      css.indexOf(".scene__bubble {"),
      css.indexOf("/* 動きを減らす設定: 動く飾り"),
    );
    assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(block), "色の直書きがあります");
  });

  it("終わりの演出は、最後の状態で止まる(forwards)。動きを減らす設定でも、その状態になる", () => {
    for (const name of ["scene-confetti", "scene-outro-back", "scene-outro-catch", "scene-dizzy"]) {
      assert.match(css, new RegExp(`animation: ${name} [^;]*forwards`), name);
    }
  });
});
