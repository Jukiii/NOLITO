// 音の中身と設定(Phase 16 PR 3)のテスト: sound.js(純粋なデータと計算)と、設定への反映。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  BGM_BPM,
  BGM_GAIN,
  BGM_STEPS,
  BGM_STEP_SEC,
  DEFAULT_SOUND_MODE,
  DEFAULT_VOLUME,
  EFFECT_NAMES,
  SOUND_EFFECTS,
  SOUND_MODES,
  WAVES,
  bgmStepNotes,
  effectNotes,
  isAudible,
  isSoundMode,
  masterGain,
  normalizeVolume,
  toggledMode,
} from "../public/assets/js/games/escape-boss/sound.js";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
  saveSettings,
} from "../public/assets/js/games/escape-boss/settings.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

describe("音の設定の値", () => {
  it("モードは、off(なし)・se(効果音だけ)・all(効果音 + BGM)。既定は、なし", () => {
    assert.deepEqual([...SOUND_MODES], ["off", "se", "all"]);
    assert.equal(DEFAULT_SOUND_MODE, "off");
    for (const mode of SOUND_MODES) assert.equal(isSoundMode(mode), true);
    for (const bad of [
      "",
      "ON",
      "bgm",
      "__proto__",
      "constructor",
      1,
      null,
      undefined,
      true,
      [],
      {},
    ]) {
      assert.equal(isSoundMode(bad), false, String(bad));
    }
  });

  it("音量は、0〜100 の整数。範囲外は端に丸め、小数は四捨五入。数でないものは、既定(50)", () => {
    assert.equal(DEFAULT_VOLUME, 50);
    for (const [input, expected] of [
      [0, 0],
      [100, 100],
      [50, 50],
      [-5, 0],
      [101, 100],
      [1e9, 100],
      [-1e9, 0],
      [49.5, 50],
      [12.4, 12],
    ]) {
      assert.equal(normalizeVolume(input), expected, String(input));
    }
    for (const bad of [Number.NaN, Infinity, -Infinity, "50", "", null, undefined, true, [], {}]) {
      assert.equal(normalizeVolume(bad), 50, String(bad));
    }
  });

  it("全体の大きさは、音量 0 で 0、100 で 1、増えるほど大きい(2 乗の曲線)。範囲外でも、0〜1", () => {
    assert.equal(masterGain(0), 0);
    assert.equal(masterGain(100), 1);
    assert.equal(masterGain(50), 0.25);
    let previous = -1;
    for (let v = 0; v <= 100; v += 5) {
      const gain = masterGain(v);
      assert.ok(gain > previous || v === 0, `${v}`);
      assert.ok(gain >= 0 && gain <= 1);
      previous = gain;
    }
    assert.equal(masterGain(500), 1);
    assert.equal(masterGain(-5), 0);
    assert.equal(masterGain(Number.NaN), masterGain(50));
  });

  it("鳴らしてよいか: なし → どれも鳴らさない / 効果音だけ → 効果音だけ / 効果音 + BGM → 両方。音量 0 は、どれも鳴らさない", () => {
    assert.equal(isAudible("off", "se"), false);
    assert.equal(isAudible("off", "bgm"), false);
    assert.equal(isAudible("se", "se"), true);
    assert.equal(isAudible("se", "bgm"), false);
    assert.equal(isAudible("all", "se"), true);
    assert.equal(isAudible("all", "bgm"), true);
    for (const mode of SOUND_MODES) {
      assert.equal(isAudible(mode, "se", 0), false, mode);
      assert.equal(isAudible(mode, "bgm", 0), false, mode);
    }
    for (const bad of ["", "loud", undefined, null]) assert.equal(isAudible(bad, "se"), false);
    assert.equal(isAudible("all", "voice"), false, "知らない種類は、鳴らさない");
  });

  it("「音」ボタン: あり → なし。なし → 前の設定(なければ「効果音 + BGM」)。戻す先が壊れていても、落ちない", () => {
    assert.equal(toggledMode("all", "se"), "off");
    assert.equal(toggledMode("se", "all"), "off");
    assert.equal(toggledMode("off", "se"), "se");
    assert.equal(toggledMode("off", "all"), "all");
    for (const bad of [undefined, null, "off", "loud", 3]) {
      assert.equal(toggledMode("off", bad), "all", String(bad));
    }
  });
});

describe("効果音のデータ", () => {
  it("6 種類: start・correct・miss・near・clear・over。知らない名前は null(__proto__ なども)", () => {
    assert.deepEqual([...EFFECT_NAMES].sort(), [
      "clear",
      "correct",
      "miss",
      "near",
      "over",
      "start",
    ]);
    for (const name of EFFECT_NAMES) assert.ok(effectNotes(name).length >= 1, name);
    for (const bad of [
      "",
      "boom",
      "__proto__",
      "constructor",
      "toString",
      "hasOwnProperty",
      undefined,
      null,
      1,
    ]) {
      assert.equal(effectNotes(bad), null, String(bad));
    }
  });

  it("どの音符も、範囲内(高さ 50〜2500Hz・長さ 0 より大きい・大きさ 0〜0.4・決めた音色)。1.5 秒以内", () => {
    for (const [name, notes] of Object.entries(SOUND_EFFECTS)) {
      let end = 0;
      for (const item of notes) {
        assert.ok(item.hz >= 50 && item.hz <= 2500, `${name} hz ${item.hz}`);
        assert.ok(item.sec > 0 && item.sec <= 1, `${name} sec ${item.sec}`);
        assert.ok(item.at >= 0, `${name} at ${item.at}`);
        assert.ok(item.gain > 0 && item.gain <= 0.4, `${name} gain ${item.gain}`);
        assert.ok(WAVES.includes(item.wave), `${name} wave ${item.wave}`);
        if (item.to !== undefined) assert.ok(item.to >= 50 && item.to <= 2500, `${name} to`);
        end = Math.max(end, item.at + item.sec);
      }
      assert.ok(end <= 1.5, `${name}: ${end} 秒`);
    }
  });

  it("ミスは低く、下がる。クリアは上がっていく。ゲームオーバーは下がっていく(音でも、違いがわかる)", () => {
    const miss = SOUND_EFFECTS.miss[0];
    assert.ok(miss.hz < 300 && miss.to < miss.hz);
    const rising = (notes) => notes.every((n, i) => i === 0 || n.hz > notes[i - 1].hz);
    const falling = (notes) => notes.every((n, i) => i === 0 || n.hz < notes[i - 1].hz);
    assert.ok(rising(SOUND_EFFECTS.clear));
    assert.ok(falling(SOUND_EFFECTS.over));
    assert.ok(rising(SOUND_EFFECTS.start));
  });

  it("定義は、書き換えられない(凍結)", () => {
    assert.ok(Object.isFrozen(SOUND_EFFECTS));
    for (const notes of Object.values(SOUND_EFFECTS)) {
      assert.ok(Object.isFrozen(notes));
      for (const item of notes) assert.ok(Object.isFrozen(item));
    }
    assert.throws(() => {
      "use strict";
      SOUND_EFFECTS.miss[0].hz = 1;
    }, TypeError);
  });

  it("1 語ごとの音(correct)は、短く、小さい(打つたびに鳴るので、うるさくならない)", () => {
    const total = Math.max(...SOUND_EFFECTS.correct.map((n) => n.at + n.sec));
    assert.ok(total <= 0.25, `${total} 秒`);
    assert.ok(Math.max(...SOUND_EFFECTS.correct.map((n) => n.gain)) <= 0.2);
  });
});

describe("BGM のデータ", () => {
  it("テンポ 140・8 分音符 32 個(4 小節)のくり返し。1 拍は約 0.214 秒", () => {
    assert.equal(BGM_BPM, 140);
    assert.equal(BGM_STEPS, 32);
    assert.ok(Math.abs(BGM_STEP_SEC - 60 / 140 / 2) < 1e-12);
  });

  it("何周目でも同じ(32 拍でくり返す)。休みの拍は、空", () => {
    for (let step = 0; step < 64; step += 1) {
      assert.deepEqual(bgmStepNotes(step), bgmStepNotes(step % 32), `${step}`);
    }
    assert.equal(bgmStepNotes(1).length, 0);
    assert.equal(bgmStepNotes(0).length, 2, "拍の頭は、低音とメロディー");
  });

  it("壊れた拍(負・小数・数でない)は、空(落ちない)", () => {
    for (const bad of [-1, 1.5, Number.NaN, Infinity, "0", null, undefined, {}]) {
      assert.deepEqual(bgmStepNotes(bad), [], String(bad));
    }
  });

  it("どの音符も範囲内。メロディーは小さく(低音より小さい)、BGM は効果音より小さい", () => {
    let melody = 0;
    let bass = 0;
    for (let step = 0; step < BGM_STEPS; step += 1) {
      for (const item of bgmStepNotes(step)) {
        assert.ok(item.hz >= 50 && item.hz <= 2500, `${step} ${item.hz}`);
        assert.ok(item.sec > 0 && item.sec <= BGM_STEP_SEC * 2);
        assert.ok(item.gain > 0 && item.gain <= 0.4);
        if (item.wave === "square") melody = Math.max(melody, item.gain);
        else bass = Math.max(bass, item.gain);
      }
    }
    assert.ok(melody < bass, `メロディー ${melody} / 低音 ${bass}`);
    assert.ok(BGM_GAIN > 0 && BGM_GAIN < 1);
  });
});

describe("設定への反映(settings.js)", () => {
  const fakeBackend = (initial = {}) => {
    const map = new Map(Object.entries(initial));
    return {
      map,
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => map.set(key, value),
    };
  };

  it("既定は、音なし・音量 50", () => {
    assert.equal(DEFAULT_SETTINGS.soundMode, "off");
    assert.equal(DEFAULT_SETTINGS.volume, 50);
    assert.deepEqual(loadSettings(fakeBackend()).soundMode, "off");
  });

  it("保存して、読める。ほかの設定と、独立", () => {
    const backend = fakeBackend();
    assert.equal(
      saveSettings(backend, { showExplanation: true, soundMode: "se", volume: 30 }),
      true,
    );
    const loaded = loadSettings(backend);
    assert.equal(loaded.soundMode, "se");
    assert.equal(loaded.volume, 30);
    assert.equal(loaded.showExplanation, true);
    assert.equal(loaded.weakBoost, "normal");
  });

  it("壊れた値は、既定に戻す(音量は、範囲内に丸める)。以前の設定(音の項目がない)は、補う", () => {
    for (const bad of ["", "loud", "ALL", "__proto__", 1, null, true, [], {}]) {
      assert.equal(normalizeSettings({ soundMode: bad }).soundMode, "off", String(bad));
    }
    assert.equal(normalizeSettings({ volume: 250 }).volume, 100);
    assert.equal(normalizeSettings({ volume: -3 }).volume, 0);
    assert.equal(normalizeSettings({ volume: "70" }).volume, 50);
    const old = loadSettings(
      fakeBackend({
        "nolito:escape-boss:settings:v1":
          '{"showExplanation":true,"weakBoost":"off","inputStyle":"kunrei"}',
      }),
    );
    assert.deepEqual(old, {
      showExplanation: true,
      weakBoost: "off",
      inputStyle: "kunrei",
      soundMode: "off",
      volume: 50,
    });
  });

  it("記録(nolito:escape-boss:v1)の形は、変わらない(設定は、別のキー)", () => {
    const backend = fakeBackend({ "nolito:escape-boss:v1": '{"version":3}' });
    saveSettings(backend, { soundMode: "all", volume: 80 });
    assert.equal(backend.getItem("nolito:escape-boss:v1"), '{"version":3}');
  });
});

describe("sound.js は、DOM・音の出力・保存・時計に触れない", () => {
  it("document・window・AudioContext・storage・Date・fetch を、使わない", () => {
    const source = read("public/assets/js/games/escape-boss/sound.js");
    assert.ok(
      !/\b(document|window|AudioContext|localStorage|sessionStorage|Date|fetch|performance)\b/.test(
        source,
      ),
    );
  });
});
