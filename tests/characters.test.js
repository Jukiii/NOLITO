import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { chaserImageOf, playerImageOf } from "../public/assets/js/games/escape-boss/scene.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const roles = JSON.parse(read("public/data/roles.json"));
const jobs = JSON.parse(read("public/data/jobs.json"));
const play = read("public/games/escape-boss/index.html");
const css = read("public/assets/css/game.css");
const view = read("public/assets/js/games/escape-boss/view.js");

const FRAMES = 6;
const PIXEL_SCALE = 3;
const CHASERS = roles.map((role) => ({
  id: role.id,
  path: `public${role.image}`,
  frame: [120, 80],
}));
const PLAYERS = [
  {
    id: "player",
    path: "public/assets/img/escape-boss/player.svg",
  },
  {
    id: "player-panic",
    path: "public/assets/img/escape-boss/player-panic.svg",
  },
];
const ALL = [
  ...CHASERS.map((item) => ({ ...item, size: [720, 80] })),
  ...PLAYERS.map((item) => ({ ...item, size: [384, 80], frame: [64, 80] })),
];
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readPng(path) {
  const svg = read(path);
  const source =
    /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0[ ]0[ ]\d+[ ]\d+" width="\d+" height="\d+">\n {2}<image href="data:image\/png;base64,([A-Za-z0-9+/=]+)" width="\d+" height="\d+" preserveAspectRatio="none" \/>\n<\/svg>\n$/.exec(
      svg,
    );
  assert.ok(source, `${path} は自己完結した PNG 素材を表示します`);
  const bytes = Buffer.from(source[1], "base64");
  assert.deepEqual(bytes.subarray(0, 8), PNG_SIGNATURE, `${path} は PNG です`);
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR", `${path} に PNG ヘッダーがあります`);
  return {
    bytes,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
  };
}

function readSpritePng(path) {
  const bytes = readFileSync(`${root}${path}`);
  assert.deepEqual(bytes.subarray(0, 8), PNG_SIGNATURE, `${path} は PNG です`);
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR", `${path} に PNG ヘッダーがあります`);
  return {
    bytes,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
  };
}

describe("キャラクターの絵の一覧", () => {
  it("5 役職すべてに絵がある。あなたの絵は、ふつうと焦った顔の 2 枚", () => {
    assert.equal(CHASERS.length, 5);
    for (const { id, path } of ALL) {
      assert.ok(statSync(`${root}${path}`).isFile(), id);
    }
  });

  it("7 点のキャラクター画像は、それぞれ異なる", () => {
    const images = ALL.map(({ path }) => readPng(path).bytes.toString("base64"));
    assert.equal(new Set(images).size, ALL.length);
  });

  it("HTML の表示寸法は、6 コマの画像シートの比率と合う", () => {
    const sizeOf = (src) => {
      const image = play.match(/<img[^>]*>/g).find((tag) => tag.includes(`src="${src}"`));
      assert.ok(image, `${src} が、画面にあります`);
      return [/width="(\d+)"/.exec(image)[1], /height="(\d+)"/.exec(image)[1]].map(Number);
    };
    assert.deepEqual(sizeOf("/assets/img/escape-boss/player.svg"), [384, 80]);
    assert.deepEqual(sizeOf("/assets/img/escape-boss/player-panic.svg"), [384, 80]);
    assert.deepEqual(sizeOf(roles[0].image), [720, 80]);
  });
});

for (const { id, path, size, frame } of ALL) {
  describe(`絵 ${id}`, () => {
    it("外部参照なしの、透明背景・高解像度 PNG 素材を埋め込む", () => {
      const svg = read(path);
      const png = readPng(path);
      assert.ok(
        svg.includes(`viewBox="0 0 ${size[0]} ${size[1]}" width="${size[0]}" height="${size[1]}"`),
      );
      assert.deepEqual(
        [png.width, png.height],
        [frame[0] * FRAMES * PIXEL_SCALE, frame[1] * PIXEL_SCALE],
      );
      assert.equal(png.colorType, 6, "アルファ透過のある RGBA 画像です");
      assert.ok(png.bytes.length <= 200_000, `${png.bytes.length} バイト`);
    });
  });
}

describe("危ないときの、あなたの表情", () => {
  it("画面に、ふつうの顔と焦った顔の 2 枚がある。どちらも飾り(alt が空)", () => {
    assert.match(play, /class="scene__player scene__player--calm"/);
    assert.match(play, /class="scene__player scene__player--panic"/);
  });

  it("焦った顔は、ふつうは隠れ、危ない(.is-danger)ときだけ出る", () => {
    assert.match(
      css,
      /\.scene__player--panic,\s*\.scene\.is-danger \.scene__player--calm\s*\{\s*display: none;/,
    );
    assert.match(css, /\.scene\.is-danger \.scene__player--panic\s*\{[^}]*display: block;/);
  });

  it("焦った顔の絵は、ふつうの顔と同じ表示寸法", () => {
    assert.deepEqual(
      [readPng(PLAYERS[0].path).width, readPng(PLAYERS[0].path).height],
      [readPng(PLAYERS[1].path).width, readPng(PLAYERS[1].path).height],
    );
  });
});

describe("職種別キャラクター", () => {
  const characterJobs = jobs.filter((job) => job.character_dir);

  it("利用可能な職種の選択に、味方・敵の各スプライトを切り替える", () => {
    assert.deepEqual(
      characterJobs.map((job) => job.id),
      ["engineer", "sales", "office"],
    );
    for (const job of characterJobs) {
      assert.equal(playerImageOf(job), `${job.character_dir}/player.png`);
      assert.equal(playerImageOf(job, true), `${job.character_dir}/player-panic.png`);
      for (const role of roles) {
        assert.equal(chaserImageOf(job, role), `${job.character_dir}/${role.id}.png`);
      }
    }
    assert.match(view, /data-player-calm/);
    assert.match(view, /data-player-panic/);
    assert.match(view, /data-ready-character/);
    assert.match(view, /chaserImageOf\(job, role\)/);
    assert.match(view, /playerImageOf\(job, true\)/);
    assert.match(play, /data-player-calm/);
    assert.match(play, /data-player-panic/);
    assert.match(play, /data-ready-character/);
  });

  it("各スプライトは6コマの透過PNGで、既存の寸法とファイルサイズに収まる", () => {
    for (const job of characterJobs) {
      const paths = [
        playerImageOf(job),
        playerImageOf(job, true),
        ...roles.map((role) => chaserImageOf(job, role)),
      ];
      for (const path of paths) {
        const asset = readSpritePng(`public${path}`);
        const player = path.endsWith("/player.png") || path.endsWith("/player-panic.png");
        assert.deepEqual([asset.width, asset.height], [player ? 384 : 720, 80], path);
        assert.equal(asset.colorType, 6, `${path} はアルファチャンネルを持ちます`);
        assert.ok(asset.bytes.length <= 200_000, `${path}: ${asset.bytes.length} バイト`);
      }
    }
  });

  it("素材がない職種は既存の共通キャラクターを使い、不正な参照は受け付けない", () => {
    const job = jobs.find((item) => item.id === "food-service");
    assert.equal(playerImageOf(job), "/assets/img/escape-boss/player.svg");
    assert.equal(playerImageOf(job, true), "/assets/img/escape-boss/player-panic.svg");
    assert.equal(chaserImageOf(job, roles[0]), roles[0].image);
    assert.equal(
      playerImageOf({ id: "engineer", character_dir: "https://example.com/player.png" }),
      "/assets/img/escape-boss/player.svg",
    );
    assert.equal(
      chaserImageOf(job, { id: "senpai", image: "https://example.com/senpai.svg" }),
      roles[0].image,
    );
  });
});
