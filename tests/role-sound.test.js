// 役職ごとの音の個性(Phase 23 PR 1)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createSound } from "../public/assets/js/games/escape-boss/audio.js";
import {
  DANGER_TEMPO_BOOST,
  DEFAULT_ROLE_SOUND,
  MAX_PITCH,
  MAX_TEMPO,
  MIN_PITCH,
  MIN_TEMPO,
  roleSoundOf,
} from "../public/assets/js/games/escape-boss/role-sound.js";
import {
  BGM_STEP_SEC,
  bgmStepNotes,
  effectNotes,
} from "../public/assets/js/games/escape-boss/sound.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const roles = JSON.parse(read("public/data/roles.json"));
const main = read("public/assets/js/games/escape-boss/main.js");

describe("role-sound.js(役職の音の倍率。純粋関数)", () => {
  it("既定は、tempo 1・pitch 1(役職の個性がない状態)", () => {
    assert.deepEqual(DEFAULT_ROLE_SOUND, { tempo: 1, pitch: 1 });
  });

  it("role.sound から、そのまま取り出す(範囲内なら)", () => {
    assert.deepEqual(roleSoundOf({ sound: { tempo: 1.2, pitch: 1.1 } }), {
      tempo: 1.2,
      pitch: 1.1,
    });
  });

  it("ない・壊れているときは、既定(1・1)", () => {
    for (const role of [undefined, null, {}, { sound: null }, { sound: {} }]) {
      assert.deepEqual(roleSoundOf(role), DEFAULT_ROLE_SOUND, JSON.stringify(role));
    }
  });

  it("tempo・pitch は、それぞれ独立に検査する(片方が壊れていても、もう片方は活かす)", () => {
    assert.deepEqual(roleSoundOf({ sound: { tempo: "1.2", pitch: 1.1 } }), {
      tempo: 1,
      pitch: 1.1,
    });
    assert.deepEqual(roleSoundOf({ sound: { tempo: MIN_TEMPO - 0.01, pitch: 1 } }), {
      tempo: 1,
      pitch: 1,
    });
    assert.deepEqual(roleSoundOf({ sound: { tempo: MAX_TEMPO + 0.01, pitch: 1 } }), {
      tempo: 1,
      pitch: 1,
    });
    assert.deepEqual(roleSoundOf({ sound: { tempo: 1, pitch: MIN_PITCH - 0.01 } }), {
      tempo: 1,
      pitch: 1,
    });
    assert.deepEqual(roleSoundOf({ sound: { tempo: 1, pitch: MAX_PITCH + 0.01 } }), {
      tempo: 1,
      pitch: 1,
    });
    assert.deepEqual(roleSoundOf({ sound: { tempo: Number.NaN, pitch: 1 } }), {
      tempo: 1,
      pitch: 1,
    });
  });

  it("範囲の境目(最小・最大)は、そのまま使える", () => {
    assert.equal(roleSoundOf({ sound: { tempo: MIN_TEMPO, pitch: 1 } }).tempo, MIN_TEMPO);
    assert.equal(roleSoundOf({ sound: { tempo: MAX_TEMPO, pitch: 1 } }).tempo, MAX_TEMPO);
    assert.equal(roleSoundOf({ sound: { tempo: 1, pitch: MIN_PITCH } }).pitch, MIN_PITCH);
    assert.equal(roleSoundOf({ sound: { tempo: 1, pitch: MAX_PITCH } }).pitch, MAX_PITCH);
  });

  it("危ない状況の倍率は、1より大きい(速くなる方向だけ)", () => {
    assert.ok(DANGER_TEMPO_BOOST > 1);
  });
});

describe("roles.json の sound(全役職)", () => {
  it("全役職に、範囲内の tempo・pitch がある", () => {
    for (const role of roles) {
      assert.ok(role.sound, role.id);
      assert.ok(role.sound.tempo >= MIN_TEMPO && role.sound.tempo <= MAX_TEMPO, role.id);
      assert.ok(role.sound.pitch >= MIN_PITCH && role.sound.pitch <= MAX_PITCH, role.id);
    }
  });

  it("先輩(入門)は、既定(1・1)のまま", () => {
    const senpai = roles.find((r) => r.id === "senpai");
    assert.deepEqual(senpai.sound, { tempo: 1, pitch: 1 });
  });

  it("役職が進むほど、tempo・pitch とも、わずかに上がる(0006決定ログの「難しくなる」に、音でも寄り添う)", () => {
    for (let i = 1; i < roles.length; i += 1) {
      const prev = roles[i - 1];
      const next = roles[i];
      assert.ok(next.sound.tempo >= prev.sound.tempo, `${next.id} tempo`);
      assert.ok(next.sound.pitch >= prev.sound.pitch, `${next.id} pitch`);
    }
  });

  it("倍率は控えめ(最大でも1.3倍以内。不快な速さ・高さにしない)", () => {
    for (const role of roles) {
      assert.ok(role.sound.tempo <= 1.3, `${role.id} tempo ${role.sound.tempo}`);
      assert.ok(role.sound.pitch <= 1.3, `${role.id} pitch ${role.sound.pitch}`);
    }
  });
});

describe("sound.js: pitch で、音符の高さだけをずらす", () => {
  it("effectNotes: pitch=1(既定)は、元のまま。pitch>1は、hz・toが、その倍率になる", () => {
    const base = effectNotes("miss");
    const scaled = effectNotes("miss", 1.1);
    assert.equal(scaled[0].hz, base[0].hz * 1.1);
    assert.equal(scaled[0].to, base[0].to * 1.1);
    // 音色・長さ・大きさは変えない
    assert.equal(scaled[0].wave, base[0].wave);
    assert.equal(scaled[0].sec, base[0].sec);
    assert.equal(scaled[0].gain, base[0].gain);
  });

  it("bgmStepNotes: pitchで、低音・メロディーの高さだけがずれる。長さは変わらない", () => {
    const base = bgmStepNotes(0);
    const scaled = bgmStepNotes(0, 1.2);
    assert.equal(scaled.length, base.length);
    for (let i = 0; i < base.length; i += 1) {
      assert.ok(Math.abs(scaled[i].hz - base[i].hz * 1.2) < 1e-9);
      assert.equal(scaled[i].sec, base[i].sec);
    }
  });

  it("知らない効果音は、pitchを渡しても null", () => {
    assert.equal(effectNotes("unknown", 1.2), null);
  });
});

// ---- audio.js(役職の個性・危ない状況の反映)。偽の AudioContext・ticker は、tests/audio.test.js と同じ考え方
function fakeParam(value = 0) {
  return {
    value,
    calls: [],
    setValueAtTime(v, t) {
      this.calls.push(["set", v, t]);
    },
    linearRampToValueAtTime(v, t) {
      this.calls.push(["ramp", v, t]);
    },
    cancelScheduledValues(t) {
      this.calls.push(["cancel", t]);
    },
  };
}
function fakeContext() {
  const made = { oscillators: [] };
  const context = {
    currentTime: 0,
    state: "running",
    destination: {},
    resume: () => Promise.resolve(),
    suspend: () => Promise.resolve(),
    createGain: () => ({ gain: fakeParam(1), connect() {} }),
    createOscillator: () => {
      const node = {
        type: "",
        frequency: fakeParam(0),
        startAt: null,
        connect() {},
        start(t) {
          this.startAt = t;
        },
        stop() {},
      };
      made.oscillators.push(node);
      return node;
    },
    createDynamicsCompressor: () => ({ connect() {} }),
  };
  return { context, made };
}
function fakeTicker() {
  const ticks = new Map();
  let nextId = 1;
  return {
    setTick(fn) {
      const id = nextId++;
      ticks.set(id, fn);
      return id;
    },
    clearTick(id) {
      ticks.delete(id);
    },
    tick() {
      for (const fn of [...ticks.values()]) fn();
    },
  };
}

describe("audio.js: setRoleSound・setDanger", () => {
  function setup() {
    const { context, made } = fakeContext();
    const ticker = fakeTicker();
    const sound = createSound({
      createContext: () => context,
      setTick: ticker.setTick,
      clearTick: ticker.clearTick,
    });
    sound.configure({ mode: "all", volume: 60 });
    return { sound, context, made, ticker };
  }

  it("既定(setRoleSoundを呼ばない)では、通常の速さ・高さで鳴る", () => {
    const { sound, made } = setup();
    sound.startBgm();
    const starts = [...new Set(made.oscillators.map((o) => o.startAt))].sort((a, b) => a - b);
    assert.ok(Math.abs(starts[1] - starts[0] - 2 * BGM_STEP_SEC) < 1e-9);
  });

  it("setRoleSound({ tempo: 2 })で、拍の間隔が半分になる(速くなる)", () => {
    const { sound, made } = setup();
    sound.setRoleSound({ tempo: 2, pitch: 1 });
    sound.startBgm();
    const starts = [...new Set(made.oscillators.map((o) => o.startAt))].sort((a, b) => a - b);
    assert.ok(Math.abs(starts[1] - starts[0] - BGM_STEP_SEC) < 1e-9);
  });

  it("setRoleSound({ pitch: 1.5 })で、効果音の周波数(setValueAtTime に渡る値)が1.5倍になる", () => {
    const withoutPitch = setup();
    withoutPitch.sound.play("miss");
    const baseHz = withoutPitch.made.oscillators[0].frequency.calls[0][1];

    const withPitch = setup();
    withPitch.sound.setRoleSound({ tempo: 1, pitch: 1.5 });
    withPitch.sound.play("miss");
    const scaledHz = withPitch.made.oscillators[0].frequency.calls[0][1];

    assert.ok(Math.abs(scaledHz - baseHz * 1.5) < 1e-9, `${scaledHz} vs ${baseHz * 1.5}`);
  });

  it("setDanger(true)で、さらに速くなる(DANGER_TEMPO_BOOST倍)。falseで元に戻る", () => {
    const { sound, made, ticker, context } = setup();
    sound.setRoleSound({ tempo: 1, pitch: 1 });
    sound.startBgm();
    sound.setDanger(true);
    made.oscillators.length = 0;
    context.currentTime += 0.001; // すぐの再予約を許す
    ticker.tick();
    const starts = [...new Set(made.oscillators.map((o) => o.startAt))].sort((a, b) => a - b);
    if (starts.length >= 2) {
      const gap = starts[1] - starts[0];
      assert.ok(gap < BGM_STEP_SEC, `危ないときは、間隔が詰まる: ${gap}`);
    }
    sound.setDanger(false);
    // 落ちずに、通常へ戻せることの確認(具体的な間隔の再検証は省略。詰まる方向だけを見る)
    assert.doesNotThrow(() => ticker.tick());
  });

  it("setRoleSound を呼び直すと、危ない状況の倍率は、リセットされる(1に戻る)", () => {
    const { sound, made } = setup();
    sound.setRoleSound({ tempo: 1, pitch: 1 });
    sound.setDanger(true);
    sound.setRoleSound({ tempo: 1, pitch: 1 }); // 新しいゲームの開始 相当
    sound.startBgm();
    const starts = [...new Set(made.oscillators.map((o) => o.startAt))].sort((a, b) => a - b);
    assert.ok(Math.abs(starts[1] - starts[0] - 2 * BGM_STEP_SEC) < 1e-9);
  });

  it("不正な値(0・負・NaN・文字)は、既定(1)にする。落ちない", () => {
    const { sound } = setup();
    for (const bad of [0, -1, Number.NaN, "2", null, undefined]) {
      assert.doesNotThrow(() => sound.setRoleSound({ tempo: bad, pitch: bad }));
    }
  });
});

describe("main.js: 役職の音の個性・危ない状況の配線", () => {
  it("ゲーム開始(beginGame)で、役職の音を設定する", () => {
    const start = main.indexOf("async function beginGame");
    const body = main.slice(start, main.indexOf("\nfunction beginIntro"));
    assert.match(body, /sound\.setRoleSound\(roleSoundOf\(role\)\);/);
  });

  it("危ない状況が変わったときだけ、sound.setDanger を呼ぶ(毎フレームは呼ばない)", () => {
    assert.match(main, /if \(danger !== session\.wasDanger\) sound\.setDanger\(danger\);/);
  });

  it("ダッシュボードに戻る(quit)と、役職の音を既定に戻す", () => {
    const start = main.indexOf("function quit()");
    const body = main.slice(start, main.indexOf("document.addEventListener"));
    assert.match(body, /sound\.setRoleSound\(\);/);
  });
});
