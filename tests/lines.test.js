// 追ってくる人のセリフ(Phase 16 PR 2)のテスト: 選び方(純粋なロジック)と、roles.json のセリフのデータ。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  BUBBLE_MS,
  LINE_EVENTS,
  MAX_LINE_LENGTH,
  MIN_GAP_MS,
  createLines,
  isValidLine,
  linesOf,
} from "../public/assets/js/games/escape-boss/lines.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const roles = JSON.parse(read("public/data/roles.json"));

// 見えない文字は、ソースに直接書かず、文字コードから作る
const BIDI_OVERRIDE = String.fromCodePoint(0x202e);
const ZERO_WIDTH = String.fromCodePoint(0x200b);
const NULL_CHAR = String.fromCodePoint(0);
const NEWLINE = String.fromCodePoint(10);

const role = {
  id: "x",
  lines: { start: ["a", "b", "c"], near: ["n1", "n2"], miss: ["m"], clear: ["c1"] },
};
// 決まった順に値を返す乱数
const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("isValidLine", () => {
  it("1〜20 文字の、ふつうの文字列だけ", () => {
    assert.ok(isValidLine("待てよー!"));
    assert.ok(isValidLine("あ"));
    assert.ok(isValidLine("あ".repeat(MAX_LINE_LENGTH)));
    assert.equal(MAX_LINE_LENGTH, 20);
  });

  it("空・長すぎる・前後の空白・制御文字・向きを変える文字・見えない文字・< >・文字でないものは、不可", () => {
    for (const bad of [
      "",
      "あ".repeat(MAX_LINE_LENGTH + 1),
      " あ",
      "あ ",
      `あ${NEWLINE}い`,
      `あ${NULL_CHAR}`,
      `あ${BIDI_OVERRIDE}い`,
      `あ${ZERO_WIDTH}い`,
      "<b>あ</b>",
      "a>b",
      null,
      undefined,
      42,
      ["あ"],
      {},
    ]) {
      assert.equal(isValidLine(bad), false, String(bad));
    }
  });
});

describe("linesOf", () => {
  it("使えるセリフだけを、重複なしで返す", () => {
    const r = { lines: { start: ["a", "a", "", "<x>", "b", 3, null] } };
    assert.deepEqual(linesOf(r, "start"), ["a", "b"]);
  });

  it("役職・場面・lines がない、または、配列でなくても、空(落ちない)", () => {
    assert.deepEqual(linesOf(undefined, "start"), []);
    assert.deepEqual(linesOf({}, "start"), []);
    assert.deepEqual(linesOf({ lines: null }, "start"), []);
    assert.deepEqual(linesOf({ lines: { start: "文字列" } }, "start"), []);
    assert.deepEqual(linesOf(role, "over"), []);
    assert.deepEqual(linesOf(role, "unknown"), []);
  });

  it("入力を書き換えない", () => {
    const r = { lines: { start: ["a", "a"] } };
    const before = JSON.stringify(r);
    linesOf(r, "start");
    assert.equal(JSON.stringify(r), before);
  });
});

describe("createLines().pick", () => {
  it("start・clear・over は、いつでも言う(間隔の制限を受けない)", () => {
    const lines = createLines({ rng: seq(0) });
    assert.equal(lines.pick(role, "start", 0), "a");
    assert.equal(lines.pick(role, "clear", 1), "c1");
    assert.equal(lines.pick({ ...role, lines: { over: ["o"] } }, "over", 2), "o");
  });

  it("near・miss は、前の吹き出しから 4 秒以上あける(ちょうど 4 秒は、言う)", () => {
    const lines = createLines({ rng: seq(0) });
    assert.equal(MIN_GAP_MS, 4000);
    assert.equal(lines.pick(role, "near", 10_000), "n1");
    assert.equal(lines.pick(role, "miss", 10_001), null);
    assert.equal(lines.pick(role, "miss", 13_999), null);
    assert.equal(lines.pick(role, "miss", 14_000), "m");
    assert.equal(lines.pick(role, "near", 14_500), null);
  });

  it("言わなかったときは、間隔の記憶を更新しない(言えなかった分が、次を遅らせない)", () => {
    const lines = createLines({ rng: seq(0) });
    assert.equal(lines.pick(role, "near", 0), "n1");
    assert.equal(lines.pick(role, "miss", 3000), null);
    assert.equal(lines.pick(role, "miss", 4000), "m");
  });

  it("同じ場面で、直前と同じセリフを続けない(セリフが 2 つ以上)。1 つだけなら、同じ", () => {
    const lines = createLines({ rng: seq(0) });
    const first = lines.pick(role, "start", 0);
    const second = lines.pick(role, "start", 1);
    const third = lines.pick(role, "start", 2);
    assert.notEqual(first, second);
    assert.notEqual(second, third);
    assert.equal(lines.pick(role, "clear", 3), "c1");
    assert.equal(lines.pick(role, "clear", 4), "c1");
  });

  it("乱数の端(0 と 1 に近い値)でも、範囲内のセリフを選ぶ。乱数が壊れていても、落ちない", () => {
    const list = ["a", "b", "c"];
    const r = { id: "y", lines: { start: list } };
    for (const value of [0, 0.4999, 0.5, 0.9999999, 1, 1.5, -1, Number.NaN]) {
      const line = createLines({ rng: () => value }).pick(r, "start", 0);
      assert.ok(list.includes(line), `${value} → ${line}`);
    }
  });

  it("どのセリフも、選ばれうる(偏らない)", () => {
    const seen = new Set();
    const lines = createLines({ rng: Math.random });
    for (let i = 0; i < 200; i += 1) seen.add(lines.pick(role, "start", i));
    assert.deepEqual([...seen].sort(), ["a", "b", "c"]);
  });

  it("知らない場面・時刻が数でない・セリフがない役職は、言わない(null)", () => {
    const lines = createLines();
    assert.equal(lines.pick(role, "unknown", 0), null);
    assert.equal(lines.pick(role, "start", Number.NaN), null);
    assert.equal(lines.pick(role, "start", "0"), null);
    assert.equal(lines.pick(role, "over", 0), null);
    assert.equal(lines.pick({ id: "z" }, "start", 0), null);
    assert.equal(lines.pick(undefined, "start", 0), null);
  });

  it("reset で、間隔と直前のセリフの記憶が消える(新しいゲーム)", () => {
    const lines = createLines({ rng: seq(0) });
    assert.equal(lines.pick(role, "near", 1000), "n1");
    lines.reset();
    assert.equal(lines.pick(role, "miss", 1001), "m");
    assert.equal(lines.pick(role, "near", 5001), "n1");
  });

  it("役職ごとに、直前のセリフを別に覚える", () => {
    const other = { id: "o", lines: { start: ["a", "b", "c"] } };
    const lines = createLines({ rng: seq(0) });
    assert.equal(lines.pick(role, "start", 0), "a");
    assert.equal(lines.pick(other, "start", 1), "a");
  });

  it("吹き出しは、2 秒表示する", () => {
    assert.equal(BUBBLE_MS, 2000);
  });
});

describe("roles.json のセリフ", () => {
  it("5 役職すべてに、5 つの場面(start・near・miss・clear・over)のセリフが、3 つ以上ある", () => {
    assert.deepEqual([...LINE_EVENTS], ["start", "near", "miss", "clear", "over"]);
    assert.equal(roles.length, 5);
    for (const r of roles) {
      assert.deepEqual(Object.keys(r.lines).sort(), [...LINE_EVENTS].sort(), r.id);
      for (const event of LINE_EVENTS) {
        assert.ok(r.lines[event].length >= 3, `${r.id}.${event}: ${r.lines[event].length} 個`);
      }
    }
  });

  it("すべてのセリフが、使える形(1〜20 文字・制御文字なし)。同じ場面の中で、重複しない", () => {
    for (const r of roles) {
      for (const event of LINE_EVENTS) {
        for (const line of r.lines[event]) {
          assert.ok(isValidLine(line), `${r.id}.${event}: ${line}`);
        }
        assert.equal(new Set(r.lines[event]).size, r.lines[event].length, `${r.id}.${event}`);
        assert.deepEqual(linesOf(r, event), r.lines[event], `${r.id}.${event}`);
      }
    }
  });

  it("役職の個性: 役職ごとに、セリフが違う(ほかの役職と同じセリフを使わない)", () => {
    const owner = new Map();
    for (const r of roles) {
      for (const event of LINE_EVENTS) {
        for (const line of r.lines[event]) {
          assert.ok(
            !owner.has(line) || owner.get(line) === r.id,
            `${line} が、複数の役職にあります`,
          );
          owner.set(line, r.id);
        }
      }
    }
  });

  it("lines.js・roles.json に、見えない文字(制御文字・向きを変える文字)を、直接書いていない", () => {
    for (const path of ["public/assets/js/games/escape-boss/lines.js", "public/data/roles.json"]) {
      const text = read(path);
      assert.ok(!/[\p{Cf}\p{Zl}\p{Zp}]/u.test(text), `${path}: 見えない文字`);
      assert.ok(!/[\p{Cc}]/u.test(text.replaceAll(NEWLINE, "")), `${path}: 制御文字`);
    }
  });

  it("lines.js は、DOM・保存・時計に触れない(純粋なロジック)", () => {
    const source = read("public/assets/js/games/escape-boss/lines.js");
    assert.ok(
      !/\b(document|window|localStorage|sessionStorage|performance|Date|fetch|setTimeout)\b/.test(
        source,
      ),
    );
  });
});

describe("main.js のセリフのつなぎ", () => {
  const main = read("public/assets/js/games/escape-boss/main.js");

  it("開始・危ない(入った瞬間だけ)・ミス(ゲームオーバーにならなかったとき)・クリア・ゲームオーバーで、言う", () => {
    assert.match(main, /say\("start"\);/);
    assert.match(main, /if \(danger && !session\.wasDanger\) say\("near"\);/);
    assert.match(main, /if \(session\.state\.status === "playing"\) say\("miss"\);/);
    assert.match(main, /session\.state\.status === "cleared" \? "clear" : "over"/);
  });

  it("新しいゲームごとに、セリフの記憶を作り直す(createLines)", () => {
    assert.match(main, /lines: createLines\(\)/);
  });

  it("吹き出しは飾り(場面の中・aria-hidden)。結果の画面には、セリフの引用を出す", () => {
    const html = read("public/games/escape-boss/index.html");
    const scene = html.slice(
      html.indexOf('<div class="scene"'),
      html.indexOf('<div class="game-word">'),
    );
    assert.match(scene, /aria-hidden="true"/);
    assert.ok(scene.includes("data-bubble"));
    assert.match(main, /view\.showResult\(\{ \.\.\.resultView, quote: line \?\? "" \}\)/);
  });
});
