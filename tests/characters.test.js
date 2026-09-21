// キャラクターの絵(Phase 16 PR 1)のテスト: 絵のファイル(SVG)の形・安全・色と、roles.json・画面との対応。
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const roles = JSON.parse(read("public/data/roles.json"));
const play = read("public/games/escape-boss/index.html");
const css = read("public/assets/css/game.css");

const OUTLINE = "#1b2033";
const SKIN = "#ffd9b3";

// 使ってよい色(サイトの配色に、少数の色を足したもの)。色を足すときは、ここと、決定ログ 0030 を直す
const PALETTE = new Set([
  OUTLINE, // 輪郭・髪
  SKIN, // 肌
  "#ff9f8f", // ほお
  "#ffffff",
  "#4b3fe0", // 主役の色(サイトのプライマリ)
  "#ffd23f", // 強調の色(サイトのアクセント)
  "#e5484d", // 赤(ネクタイ・口・ランプ)
  "#6b7189", // ズボン
  "#c9cedd", // 明るい灰色
  "#d9f0ff", // 窓・ガラス
  "#8fd3ff", // 汗
  "#35a58a", // 部長の車
  "#3b4570", // 社長の車
]);

// 追ってくる人の絵(120×80)と、あなたの絵(64×80)
const CHASERS = roles.map((role) => ({ id: role.id, path: `public${role.image}` }));
const PLAYERS = [
  { id: "player", path: "public/assets/img/escape-boss/player.svg" },
  { id: "player-panic", path: "public/assets/img/escape-boss/player-panic.svg" },
];
const ALL = [
  ...CHASERS.map((c) => ({ ...c, size: [120, 80] })),
  ...PLAYERS.map((c) => ({ ...c, size: [64, 80] })),
];

// 使ってよい要素・属性(図形だけ。文字・画像・スクリプト・動き・外部の参照は、使わない)
const ELEMENTS = new Set(["svg", "g", "rect", "circle", "ellipse", "line", "path", "polygon"]);
const ATTRIBUTES = new Set([
  "xmlns",
  "viewBox",
  "width",
  "height",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "transform",
  "x",
  "y",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
]);

// SVG を、タグの並びにする(簡単な読み取り。閉じ忘れ・入れ子の誤りを見つける)
function parseSvg(text) {
  const tags = [...text.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^<>]*?)(\/?)>/g)];
  const stack = [];
  const elements = [];
  for (const [, closing, name, rest, selfClosing] of tags) {
    if (closing) {
      assert.equal(stack.pop(), name, `${name} の閉じ方が、合っていません`);
    } else {
      const attrs = Object.fromEntries(
        [...rest.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
      );
      elements.push({ name, attrs });
      if (!selfClosing) stack.push(name);
    }
  }
  assert.equal(stack.length, 0, "閉じていないタグがあります");
  return elements;
}

describe("キャラクターの絵の一覧", () => {
  it("5 役職すべてに、絵がある(roles.json の image)。あなたの絵は、ふつうと焦った顔の 2 枚", () => {
    assert.equal(CHASERS.length, 5);
    for (const { id, path } of ALL) assert.ok(statSync(`${root}${path}`).isFile(), id);
  });

  it("絵は、どれも違う(同じ内容のファイルがない)。焦った顔は、ふつうの顔と違う", () => {
    const texts = ALL.map(({ path }) => read(path));
    assert.equal(new Set(texts).size, ALL.length);
  });

  it("画面(HTML)の絵の大きさの指定が、絵の viewBox と同じ(レイアウトがずれない)", () => {
    const sizeOf = (src) => {
      const image = play.match(/<img[^>]*>/g).find((tag) => tag.includes(`src="${src}"`));
      assert.ok(image, `${src} が、画面にありません`);
      return [/width="(\d+)"/.exec(image)[1], /height="(\d+)"/.exec(image)[1]].map(Number);
    };
    assert.deepEqual(sizeOf("/assets/img/escape-boss/player.svg"), [64, 80]);
    assert.deepEqual(sizeOf("/assets/img/escape-boss/player-panic.svg"), [64, 80]);
    assert.deepEqual(sizeOf(roles[0].image), [120, 80]);
  });
});

for (const { id, path, size } of ALL) {
  describe(`絵 ${id}`, () => {
    const text = read(path);
    const elements = parseSvg(text);

    it("小さい(4KB 以内)。SVG として閉じている。大きさは viewBox・width・height がそろう", () => {
      assert.ok(
        statSync(`${root}${path}`).size <= 4096,
        `${statSync(`${root}${path}`).size} バイト`,
      );
      assert.ok(text.trimStart().startsWith("<svg ") && text.trimEnd().endsWith("</svg>"));
      const svg = elements[0];
      assert.equal(svg.name, "svg");
      assert.equal(svg.attrs.xmlns, "http://www.w3.org/2000/svg");
      assert.equal(svg.attrs.viewBox, `0 0 ${size[0]} ${size[1]}`);
    });

    it("使う要素・属性は、図形だけ。文字・画像・スクリプト・スタイル・動き・外部の参照は、ない", () => {
      for (const { name, attrs } of elements) {
        assert.ok(ELEMENTS.has(name), `要素 ${name}`);
        for (const [key, value] of Object.entries(attrs)) {
          assert.ok(ATTRIBUTES.has(key), `属性 ${key}`);
          if (key === "xmlns") continue;
          assert.ok(!/https?:|data:|javascript:|\/\//i.test(value), `${key}="${value}"`);
        }
      }
      assert.ok(
        !/<(script|style|image|foreignObject|text|a|animate|set|filter|mask|clipPath|use|defs|iframe)\b/i.test(
          text,
        ),
      );
      assert.ok(!/@import|<!ENTITY|<!DOCTYPE|<\?xml|\son\w+=/i.test(text));
    });

    it("色は、決めた配色(PALETTE)の 16 進の色だけ。輪郭は、濃い色(#1b2033)", () => {
      assert.equal(elements[0].attrs.stroke, OUTLINE);
      for (const { attrs } of elements) {
        for (const key of ["fill", "stroke"]) {
          if (attrs[key] === undefined || attrs[key] === "none") continue;
          assert.match(attrs[key], /^#[0-9a-f]{6}$/, `${key}="${attrs[key]}"`);
          assert.ok(PALETTE.has(attrs[key]), `${attrs[key]} は、配色にありません`);
        }
      }
    });

    it("ポップなデフォルメ: 顔(肌の色の円)が、大きい(直径が、絵の高さの 25% 以上)", () => {
      const heads = elements.filter((e) => e.name === "circle" && e.attrs.fill === SKIN);
      const biggest = Math.max(...heads.map((e) => Number(e.attrs.r)));
      assert.ok(biggest * 2 >= size[1] * 0.25, `顔の直径 ${biggest * 2}`);
    });
  });
}

describe("危ないときの、あなたの表情", () => {
  it("画面に、ふつうの顔と焦った顔の 2 枚がある。どちらも飾り(alt が空)", () => {
    assert.match(play, /class="scene__player scene__player--calm"/);
    assert.match(play, /class="scene__player scene__player--panic"/);
  });

  it("CSS: 焦った顔は、ふつうは隠れ、危ない(.is-danger)ときだけ出る。ふつうの顔は、そのとき隠れる", () => {
    assert.match(
      css,
      /\.scene__player--panic,\s*\.scene\.is-danger \.scene__player--calm\s*\{\s*display: none;/,
    );
    assert.match(css, /\.scene\.is-danger \.scene__player--panic\s*\{\s*display: block;/);
  });

  it("焦った顔の絵は、ふつうの顔と、同じ大きさ(切り替えで、位置がずれない)", () => {
    const viewBox = (path) => /viewBox="([^"]+)"/.exec(read(path))[1];
    assert.equal(viewBox(PLAYERS[0].path), viewBox(PLAYERS[1].path));
  });
});
