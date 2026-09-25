// 職種別の背景(Phase 15 PR 2)のテスト: 絵のファイル(SVG)の形・安全・淡さと、jobs.json との対応、読み込みの安全。
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { backgroundOf } from "../public/assets/js/games/escape-boss/scene.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const jobs = JSON.parse(read("public/data/jobs.json"));

// 背景に使ってよい要素・属性(装飾の図形だけ。文字・画像・スクリプト・動きは、使わない)
const ELEMENTS = new Set([
  "svg",
  "defs",
  "g",
  "rect",
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "pattern",
  "use",
]);
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
  "id",
  "x",
  "y",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x1",
  "y1",
  "x2",
  "y2",
  "d",
  "points",
  "href",
  "patternUnits",
  "opacity",
]);

// 色の明るさ(WCAG)と、比
const channel = (value) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex;
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

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
      elements.push({ name, attrs, depth: stack.length, defs: stack.includes("defs") });
      if (!selfClosing) stack.push(name);
    }
  }
  assert.equal(stack.length, 0, "閉じていないタグがあります");
  return elements;
}

describe("jobs.json と、背景の絵", () => {
  it("6 職種すべてに、background があり、決まった場所の SVG で、ファイルが存在する", () => {
    assert.equal(jobs.length, 6);
    for (const job of jobs) {
      assert.equal(job.background, `/assets/img/escape-boss/bg/${job.id}.svg`, job.id);
      assert.equal(backgroundOf(job), job.background, job.id);
      assert.ok(statSync(`${root}public${job.background}`).isFile(), job.id);
    }
    assert.equal(new Set(jobs.map((job) => job.background)).size, jobs.length);
  });

  it("背景の絵は、職種ごとに、違う絵(同じ内容のファイルがない)", () => {
    const texts = jobs.map((job) => read(`public${job.background}`));
    assert.equal(new Set(texts).size, jobs.length);
  });
});

for (const job of jobs) {
  describe(`背景 ${job.id}`, () => {
    const path = `public${job.background}`;
    const text = read(path);
    const elements = parseSvg(text);

    it("小さい(3KB 以内)。SVG として、閉じている。大きさは 360×112(繰り返して並べられる)", () => {
      assert.ok(
        statSync(`${root}${path}`).size <= 3072,
        `${statSync(`${root}${path}`).size} バイト`,
      );
      assert.ok(text.trimStart().startsWith("<svg ") && text.trimEnd().endsWith("</svg>"));
      const svg = elements[0];
      assert.equal(svg.name, "svg");
      assert.equal(svg.attrs.xmlns, "http://www.w3.org/2000/svg");
      assert.equal(svg.attrs.viewBox, "0 0 360 112");
      assert.equal(svg.attrs.width, "360");
      assert.equal(svg.attrs.height, "112");
    });

    it("使う要素・属性は、装飾の図形だけ。文字・画像・スクリプト・動き・外部の参照は、ない", () => {
      for (const { name, attrs } of elements) {
        assert.ok(ELEMENTS.has(name), `要素 ${name}`);
        for (const [key, value] of Object.entries(attrs)) {
          assert.ok(ATTRIBUTES.has(key), `属性 ${key}`);
          assert.ok(!/^on/i.test(key));
          if (key === "href") assert.match(value, /^#[\w-]+$/, "href は、同じ絵の中の id だけ");
          if (key === "xmlns") continue;
          assert.ok(!/https?:|data:|javascript:|\/\//i.test(value), `${key}="${value}"`);
        }
      }
      assert.ok(
        !/<(script|style|image|foreignObject|text|a|animate|set|filter|mask|clipPath|iframe)\b/i.test(
          text,
        ),
      );
      assert.ok(!/@import|<!ENTITY|<!DOCTYPE|<\?xml/i.test(text));
    });

    it("色は、16 進の色・none・同じ絵の中のパターンだけ。id の参照先が、ある", () => {
      const ids = new Set(elements.map((element) => element.attrs.id).filter(Boolean));
      for (const { attrs } of elements) {
        for (const key of ["fill", "stroke"]) {
          const value = attrs[key];
          if (value === undefined) continue;
          assert.match(value, /^(none|#[0-9a-f]{6}|url\(#[\w-]+\))$/i, `${key}="${value}"`);
          const ref = /^url\(#([\w-]+)\)$/.exec(value);
          if (ref) assert.ok(ids.has(ref[1]), `${ref[1]} が、ありません`);
        }
        if (attrs.href) assert.ok(ids.has(attrs.href.slice(1)), `${attrs.href} が、ありません`);
      }
    });

    it("色は、淡い(追ってくる人・自分の絵が、埋もれない)。白・場面の地の色との、明るさの比が、2.2 以下", () => {
      const colors = new Set(text.match(/#[0-9a-fA-F]{6}\b/g));
      assert.ok(colors.size >= 3, `色の数: ${colors.size}`);
      for (const color of colors) {
        assert.ok(
          contrast(color, "#ffffff") <= 2.2,
          `${color}: 白との比 ${contrast(color, "#ffffff").toFixed(2)}`,
        );
        assert.ok(
          contrast(color, "#fff1b8") <= 2.2,
          `${color}: 地の色との比 ${contrast(color, "#fff1b8").toFixed(2)}`,
        );
      }
    });

    it("追ってくる人・自分の絵の輪郭(濃い色)との、明るさの差が、十分ある(輪郭 #1b2033 との比が 3 以上)", () => {
      for (const color of new Set(text.match(/#[0-9a-fA-F]{6}\b/g))) {
        assert.ok(
          contrast(color, "#1b2033") >= 3,
          `${color}: 輪郭との比 ${contrast(color, "#1b2033").toFixed(2)}`,
        );
      }
    });

    it("図形が、左右の端(0 と 360)を、またがない(横に並べたとき、切れ目が目立たない)", () => {
      for (const { name, attrs, defs } of elements) {
        if (defs) continue;
        const number = (key) => Number(attrs[key]);
        if (name === "rect" && attrs.width !== "360") {
          assert.ok(number("x") >= 0 && number("x") + number("width") <= 360, `rect x=${attrs.x}`);
        }
        if (name === "circle" || name === "ellipse") {
          const rx = number(name === "circle" ? "r" : "rx");
          assert.ok(number("cx") - rx >= 0 && number("cx") + rx <= 360, `${name} cx=${attrs.cx}`);
        }
      }
    });
  });
}

describe("読み込み(backgroundOf)は、決まった場所の SVG だけ", () => {
  it("正しい値は、そのまま返す", () => {
    for (const path of [
      "/assets/img/escape-boss/bg/engineer.svg",
      "/assets/img/escape-boss/bg/food-service.svg",
      "/assets/img/escape-boss/bg/a1-b2.svg",
    ]) {
      assert.equal(backgroundOf({ background: path }), path);
    }
  });

  it("引用符・かっこ・空白・改行・上の階層・ほかの場所・ほかの形式・外部の URL・文字でない値は、null(CSS に入れない)", () => {
    for (const value of [
      'x.svg"); background: url("http://evil/a',
      "/assets/img/escape-boss/bg/a.svg)",
      "/assets/img/escape-boss/bg/a b.svg",
      "/assets/img/escape-boss/bg/a.svg\n",
      "/assets/img/escape-boss/bg/../../../x.svg",
      "/assets/img/escape-boss/bg/.svg",
      "/assets/img/escape-boss/bg/a.svg.png",
      "/assets/img/escape-boss/bg/a.png",
      "/assets/img/escape-boss/bg/A.svg",
      "/assets/img/escape-boss/bg/-a.svg",
      "/assets/img/escape-boss/senpai.svg",
      "/assets/img/other/a.svg",
      "//evil.example/a.svg",
      "https://evil.example/a.svg",
      "javascript:alert(1)",
      "data:image/svg+xml,<svg/>",
      "assets/img/escape-boss/bg/a.svg",
      "",
      "   ",
      5,
      null,
      undefined,
      {},
      ["/assets/img/escape-boss/bg/a.svg"],
    ]) {
      assert.equal(backgroundOf({ background: value }), null, JSON.stringify(value));
    }
    for (const job of [undefined, null, {}, "engineer", 5]) assert.equal(backgroundOf(job), null);
  });
});

describe("CSS・つなぎ", () => {
  const css = read("public/assets/css/game.css");
  const view = read("public/assets/js/games/escape-boss/view.js");
  const main = read("public/assets/js/games/escape-boss/main.js");
  const scene = css.slice(css.indexOf(".scene {"), css.indexOf(".scene.is-danger"));

  it("場面の背景は、--scene-bg(なければ none)を、横に繰り返し、下に寄せ、淡い地の色の上に重ねる", () => {
    assert.match(scene, /background-image: var\(--scene-bg, none\),\s*linear-gradient\(/);
    assert.match(scene, /background-repeat: repeat-x, no-repeat/);
    assert.match(scene, /background-position:\s*left bottom,\s*0 0/);
    assert.match(scene, /background-size:\s*auto 100%,\s*100% 100%/);
  });

  it("CSS に、外部の URL・色の直書きを、加えていない(背景の絵は、jobs.json から)", () => {
    assert.ok(!/https?:\/\//.test(css));
    assert.ok(!/url\(/.test(scene));
  });

  it("プレイの開始(連続タイピング)で、その職種の背景だけを設定する。決まった場所の SVG でなければ、背景を外す", () => {
    // グラフィックを抑える設定(Phase 22 PR3)のときは、そもそも背景を読み込まない
    assert.match(view, /const background = !simpleGraphics && backgroundOf\(job\);/);
    assert.match(view, /scene\.style\.setProperty\("--scene-bg", `url\("\$\{background\}"\)`\);/);
    assert.match(view, /else scene\.style\.removeProperty\("--scene-bg"\);/);
    assert.match(main, /view\.showPlay\(\{\s*mode: "chase",\s*job,/);
    // 用語確認には、場面がない(背景も、設定しない)
    assert.match(main, /view\.showPlay\(\{ mode: "check", jobName: job\.name/);
  });
});
