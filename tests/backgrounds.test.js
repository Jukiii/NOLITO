// 職種別の背景(Phase 15 PR 2)のテスト: 画像の形式・安全な参照・jobs.json との対応。
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { backgroundOf } from "../public/assets/js/games/escape-boss/scene.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const jobs = JSON.parse(read("public/data/jobs.json"));
const panelNames = ["engineer", "sales", "office", "food-service", "teaching", "retail"];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

describe("jobs.json と、職種別の背景画像", () => {
  it("2列×3行の背景シートを、指定順で6つの職種画像に分割している", () => {
    assert.deepEqual(
      jobs.map((job) => job.id),
      panelNames,
    );
    for (const [index, job] of jobs.entries()) {
      const expectedPath = `/assets/img/escape-boss/bg/${panelNames[index]}.png`;
      assert.equal(job.background, expectedPath);
      assert.equal(backgroundOf(job), expectedPath);
      const path = `public${expectedPath}`;
      const bytes = readFileSync(`${root}${path}`);
      assert.deepEqual(bytes.subarray(0, 8), pngSignature, `${job.id} はPNGです`);
      assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
      assert.equal(bytes.readUInt32BE(16), 424);
      assert.ok([421, 422].includes(bytes.readUInt32BE(20)));
      assert.ok(statSync(`${root}${path}`).size < 2_000_000);
    }
  });
});

describe("読み込み(backgroundOf)は、決まった場所の画像だけ", () => {
  it("正しい SVG・PNG は、そのまま返す", () => {
    for (const path of [
      "/assets/img/escape-boss/bg/engineer.svg",
      "/assets/img/escape-boss/bg/engineer.png",
      "/assets/img/escape-boss/bg/food-service.png",
      "/assets/img/escape-boss/bg/a1-b2.svg",
    ]) {
      assert.equal(backgroundOf({ background: path }), path);
    }
  });

  it("CSS の url() に使えない値は、null にする", () => {
    for (const value of [
      'x.png"); background: url("http://evil/a',
      "/assets/img/escape-boss/bg/a.png)",
      "/assets/img/escape-boss/bg/a b.png",
      "/assets/img/escape-boss/bg/a.png\n",
      "/assets/img/escape-boss/bg/../../../x.png",
      "/assets/img/escape-boss/bg/.png",
      "/assets/img/escape-boss/bg/a.png.svg",
      "/assets/img/escape-boss/bg/a.jpg",
      "/assets/img/escape-boss/bg/A.png",
      "/assets/img/escape-boss/bg/-a.png",
      "/assets/img/escape-boss/senpai.png",
      "/assets/img/other/a.png",
      "//evil.example/a.png",
      "https://evil.example/a.png",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "assets/img/escape-boss/bg/a.png",
      "",
      "   ",
      5,
      null,
      undefined,
      {},
      ["/assets/img/escape-boss/bg/a.png"],
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

  it("背景画像を横に繰り返し、職種画像のタイル幅に合わせて動かす", () => {
    assert.match(scene, /background-image: var\(--scene-bg, none\),\s*linear-gradient\(/);
    assert.match(scene, /background-repeat: repeat-x, no-repeat/);
    assert.match(scene, /background-position:\s*left bottom,\s*0 0/);
    assert.match(scene, /background-size:\s*var\(--tile-w\) 100%,\s*100% 100%/);
    assert.match(view, /background\.endsWith\("\.png"\)/);
    assert.match(view, /scene\.style\.setProperty\("--tile-w", "var\(--scene-h\)"\)/);
    assert.match(view, /else scene\.style\.removeProperty\("--tile-w"\)/);
  });

  it("CSS に外部 URL を加えず、プレイ開始時に選んだ職種の背景だけを設定する", () => {
    assert.ok(!/https?:\/\//.test(css));
    assert.ok(!/url\(/.test(scene));
    assert.match(view, /const background = !simpleGraphics && backgroundOf\(job\);/);
    assert.match(view, /scene\.style\.setProperty\("--scene-bg", `url\("\$\{background\}"\)`\);/);
    assert.match(view, /scene\.style\.removeProperty\("--scene-bg"\);/);
    assert.match(main, /view\.showPlay\(\{\s*mode: "chase",\s*job,/);
    assert.match(main, /view\.showPlay\(\{ mode: "check", jobName: job\.name/);
  });
});
