import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const roles = JSON.parse(read("public/data/roles.json"));
const play = read("public/games/escape-boss/index.html");
const css = read("public/assets/css/game.css");

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
