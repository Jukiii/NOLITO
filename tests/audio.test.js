// 音を鳴らす係(Phase 16 PR 3)のテスト: 偽の AudioContext で、何を・いつ・どの大きさで鳴らすかを検査する。
// 実際の音は、テストでは聞けない(音色・音量の好みは、人が、プレビューで確認する)。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createSound } from "../public/assets/js/games/escape-boss/audio.js";
import {
  BGM_GAIN,
  BGM_STEP_SEC,
  SOUND_EFFECTS,
  masterGain,
} from "../public/assets/js/games/escape-boss/sound.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

// ---- 偽の部品
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

function fakeContext({ state = "suspended", resumeResult } = {}) {
  const made = { oscillators: [], gains: [], compressors: 0 };
  const context = {
    currentTime: 0,
    state,
    destination: { name: "destination" },
    resumeCalls: 0,
    suspendCalls: 0,
    resume() {
      this.resumeCalls += 1;
      this.state = "running";
      return resumeResult ?? Promise.resolve();
    },
    suspend() {
      this.suspendCalls += 1;
      this.state = "suspended";
      return Promise.resolve();
    },
    createGain() {
      const node = {
        gain: fakeParam(1),
        connectedTo: [],
        connect(target) {
          this.connectedTo.push(target);
        },
      };
      made.gains.push(node);
      return node;
    },
    createOscillator() {
      const node = {
        type: "",
        frequency: fakeParam(0),
        startAt: null,
        stopAt: null,
        connectedTo: [],
        connect(target) {
          this.connectedTo.push(target);
        },
        start(t) {
          this.startAt = t;
        },
        stop(t) {
          this.stopAt = t;
        },
      };
      made.oscillators.push(node);
      return node;
    },
    createDynamicsCompressor() {
      made.compressors += 1;
      return { connect() {} };
    },
  };
  return { context, made };
}

// 偽の「一定間隔で呼ぶ」しくみ(テストが、手で進める)
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
    get count() {
      return ticks.size;
    },
  };
}

function setup({ state, mode = "all", volume = 60 } = {}) {
  const { context, made } = fakeContext({ state });
  const ticker = fakeTicker();
  let created = 0;
  const sound = createSound({
    createContext: () => {
      created += 1;
      return context;
    },
    setTick: ticker.setTick,
    clearTick: ticker.clearTick,
  });
  sound.configure({ mode, volume });
  return { sound, context, made, ticker, created: () => created };
}

describe("音の準備(AudioContext)", () => {
  it("設定が「なし」の間は、音の準備を作らない(unlock・play・startBgm でも)", () => {
    const { sound, made, created } = setup({ mode: "off" });
    sound.unlock();
    assert.equal(sound.play("correct"), false);
    sound.startBgm();
    assert.equal(created(), 0);
    assert.equal(made.oscillators.length, 0);
    assert.equal(sound.state.ready, false);
  });

  it("設定が「効果音だけ」以上になり、unlock が呼ばれたときに作る。1 回だけ作り、止まっていれば再開する", () => {
    const { sound, context, created } = setup({ mode: "se" });
    assert.equal(created(), 0, "設定しただけでは、作らない");
    sound.unlock();
    assert.equal(created(), 1);
    assert.equal(context.resumeCalls, 1);
    sound.unlock();
    assert.equal(created(), 1);
    assert.equal(context.resumeCalls, 1, "動いていれば、再開しない");
  });

  it("全体の音量をつなぐ(音量 → 圧縮 → 出力)。音量の設定が、すぐ反映される", () => {
    const { sound, made } = setup({ mode: "se", volume: 60 });
    sound.unlock();
    assert.equal(made.compressors, 1);
    const master = made.gains[0];
    assert.equal(master.gain.value, masterGain(60));
    sound.configure({ mode: "se", volume: 20 });
    assert.equal(master.gain.value, masterGain(20));
    sound.configure({ mode: "se", volume: 0 });
    assert.equal(master.gain.value, 0);
  });

  it("音の準備を作る前に決めた音量も、作ったときに反映される", () => {
    const { sound, made } = setup({ mode: "se", volume: 35 });
    sound.unlock();
    assert.equal(made.gains[0].gain.value, masterGain(35));
  });

  it("不正な設定は、既定(なし・音量 50 / 100)に丸める", () => {
    const { sound } = setup({ mode: "se" });
    sound.configure({ mode: "loud", volume: 999 });
    assert.deepEqual([sound.state.mode, sound.state.volume], ["off", 100]);
    sound.configure({});
    assert.deepEqual([sound.state.mode, sound.state.volume], ["off", 50]);
    sound.configure(undefined);
    assert.equal(sound.state.mode, "off");
  });
});

describe("効果音", () => {
  it("設定が「効果音だけ」なら、鳴る。音符の数・高さ・音色・時刻・大きさの変化が、定義どおり", () => {
    const { sound, context, made } = setup({ mode: "se" });
    context.currentTime = 5;
    assert.equal(sound.play("clear"), true);
    const notes = SOUND_EFFECTS.clear;
    assert.equal(made.oscillators.length, notes.length);
    notes.forEach((item, i) => {
      const osc = made.oscillators[i];
      assert.equal(osc.type, item.wave);
      const start = 5 + 0.01 + item.at;
      assert.ok(Math.abs(osc.startAt - start) < 1e-9, `${i} start`);
      assert.ok(osc.stopAt > start + item.sec, "音の終わりのあとに、止める");
      assert.deepEqual(osc.frequency.calls[0].slice(0, 2), ["set", item.hz]);
      // 大きさ: 0 から立ち上がり、0 に戻る(プチッという雑音を避ける)
      const envelope = made.gains[i + 1].gain.calls;
      assert.deepEqual(envelope[0].slice(0, 2), ["set", 0]);
      assert.equal(envelope[1][0], "ramp");
      assert.equal(envelope[1][1], item.gain);
      assert.equal(envelope[2][1], 0);
      assert.ok(envelope[1][2] > start && envelope[1][2] <= start + item.sec / 2 + 1e-9);
    });
  });

  it("ミスの音は、高さがすべる(130Hz へ)。全体の音量につながる", () => {
    const { sound, made } = setup({ mode: "se" });
    sound.play("miss");
    const osc = made.oscillators[0];
    assert.deepEqual(osc.frequency.calls[1].slice(0, 2), ["ramp", 130]);
    const master = made.gains[0];
    const envelopeGain = made.gains[1];
    assert.ok(envelopeGain.connectedTo.includes(master));
  });

  it("6 種類すべて、鳴らせる。知らない名前・「なし」・音量 0 では、鳴らさない(false)", () => {
    const { sound, made } = setup({ mode: "all" });
    for (const name of Object.keys(SOUND_EFFECTS)) {
      sound.configure({ mode: "all", volume: 60 });
      // 連打の制限にかからないよう、時刻を進める
      made.oscillators.length = 0;
      assert.equal(sound.play(name), true, name);
      assert.ok(made.oscillators.length >= 1);
    }
    made.oscillators.length = 0;
    assert.equal(sound.play("boom"), false);
    assert.equal(sound.play("__proto__"), false);
    sound.configure({ mode: "off", volume: 60 });
    assert.equal(sound.play("correct"), false);
    sound.configure({ mode: "all", volume: 0 });
    assert.equal(sound.play("correct"), false);
    assert.equal(made.oscillators.length, 0);
  });

  it("同じ効果音を、0.06 秒より短い間隔で重ねない(連打でも、うるさくならない)。ほかの音は別", () => {
    const { sound, context, made } = setup({ mode: "se" });
    assert.equal(sound.play("miss"), true);
    assert.equal(sound.play("miss"), false);
    assert.equal(sound.play("correct"), true);
    context.currentTime = 0.05;
    assert.equal(sound.play("miss"), false);
    context.currentTime = 0.061;
    assert.equal(sound.play("miss"), true);
    assert.equal(made.oscillators.length, 1 + 2 + 1);
  });

  it("鳴らすとき、止まっている音の準備を再開する", () => {
    const { sound, context } = setup({ mode: "se", state: "suspended" });
    sound.play("start");
    assert.equal(context.resumeCalls, 1);
  });

  it("「効果音だけ」では、BGM は鳴らない。「効果音 + BGM」でも、音量 0 なら、鳴らない", () => {
    const a = setup({ mode: "se" });
    a.sound.startBgm();
    assert.equal(a.sound.state.bgmPlaying, false);
    assert.equal(a.made.oscillators.length, 0);
    const b = setup({ mode: "all", volume: 0 });
    b.sound.startBgm();
    assert.equal(b.sound.state.bgmPlaying, false);
  });
});

describe("BGM", () => {
  it("「効果音 + BGM」で startBgm すると、先の分(約 0.5 秒)を予約して鳴らし始める", () => {
    const { sound, context, made, ticker } = setup({ mode: "all" });
    sound.startBgm();
    assert.equal(sound.state.bgmPlaying, true);
    assert.equal(ticker.count, 1);
    // 拍 0(低音 + メロディー)・拍 1(休み)・拍 2(低音 + メロディー)が予約される
    assert.equal(made.oscillators.length, 4);
    const first = Math.min(...made.oscillators.map((o) => o.startAt));
    assert.ok(Math.abs(first - (context.currentTime + 0.05)) < 1e-9);
    // 拍の間隔は、テンポどおり
    const starts = [...new Set(made.oscillators.map((o) => o.startAt))].sort((a, b) => a - b);
    assert.ok(Math.abs(starts[1] - starts[0] - 2 * BGM_STEP_SEC) < 1e-9);
  });

  it("simple(既定false。低性能な端末向け。Phase 23 PR3): true のとき、BGMのオシレーターが半分になる(低音だけ)", () => {
    const normal = setup({ mode: "all" });
    normal.sound.startBgm();
    const normalCount = normal.made.oscillators.length;

    const { sound, made, context } = setup({ mode: "all" });
    sound.configure({ mode: "all", volume: 60, simple: true });
    assert.equal(sound.state.simple, true);
    sound.startBgm();
    // 拍 0(低音のみ)・拍 1(休み)・拍 2(低音のみ)が予約される(メロディーなしで、半分)
    assert.equal(made.oscillators.length, normalCount / 2);
    assert.ok(!made.oscillators.some((o) => o.type === "square"), "メロディー(square波)がない");
    assert.ok(context.currentTime === 0);
  });

  it("configure の simple は、次に予約する拍から反映する(既定はfalse)", () => {
    const { sound } = setup({ mode: "all" });
    assert.equal(sound.state.simple, false);
    sound.configure({ mode: "all", volume: 60, simple: "yes" }); // 文字列など、true 以外は false 扱い
    assert.equal(sound.state.simple, false);
  });

  it("BGM は、全体の音量の下に、効果音より小さい大きさで、つながる", () => {
    const { sound, made } = setup({ mode: "all" });
    sound.startBgm();
    const master = made.gains[0];
    const bus = made.gains[1];
    assert.equal(bus.gain.value, BGM_GAIN);
    assert.ok(bus.connectedTo.includes(master));
    assert.ok(made.oscillators.every((o) => o.connectedTo.length === 1));
  });

  it("時間が進むと、続きを予約する。くり返しても、途切れない(何周も)", () => {
    const { sound, context, made, ticker } = setup({ mode: "all" });
    sound.startBgm();
    const previousCount = made.oscillators.length;
    for (let i = 0; i < 100; i += 1) {
      context.currentTime += 0.1;
      ticker.tick();
    }
    assert.ok(made.oscillators.length > previousCount + 40, `${made.oscillators.length}`);
    // 予約が、現在の時刻より、遠くまで(0.5 秒先まで)続いている
    const latest = Math.max(...made.oscillators.map((o) => o.startAt));
    assert.ok(latest >= context.currentTime, "先まで予約されている");
    assert.ok(latest < context.currentTime + 0.5 + BGM_STEP_SEC + 1e-9, "先に予約しすぎない");
  });

  it("delaySec だけ待って始まる(開始の効果音のあとに、BGM)", () => {
    const { sound, context, made } = setup({ mode: "all" });
    sound.startBgm({ delaySec: 0.6 });
    const first = Math.min(...made.oscillators.map((o) => o.startAt));
    assert.ok(first >= context.currentTime + 0.6);
    const { sound: sound2, made: made2, context: context2 } = setup({ mode: "all" });
    sound2.startBgm({ delaySec: -3 });
    assert.ok(Math.min(...made2.oscillators.map((o) => o.startAt)) >= context2.currentTime);
  });

  it("stopBgm: 予約を止め、消える(音量 0 へ)。そのあと、時間が進んでも、増えない。二重に呼んでも、落ちない", () => {
    const { sound, context, made, ticker } = setup({ mode: "all" });
    sound.startBgm();
    const bus = made.gains[1];
    sound.stopBgm();
    assert.equal(sound.state.bgmPlaying, false);
    assert.equal(ticker.count, 0);
    const ramp = bus.gain.calls.filter((c) => c[0] === "ramp").at(-1);
    assert.equal(ramp[1], 0);
    assert.ok(ramp[2] > context.currentTime, "すっと消える");
    const count = made.oscillators.length;
    context.currentTime += 5;
    ticker.tick();
    assert.equal(made.oscillators.length, count);
    sound.stopBgm();
    assert.equal(sound.state.bgmPlaying, false);
  });

  it("startBgm を二重に呼んでも、予約は 1 本だけ", () => {
    const { sound, ticker } = setup({ mode: "all" });
    sound.startBgm();
    sound.startBgm();
    assert.equal(ticker.count, 1);
  });

  it("流したい状態のまま設定を変えると、その場で、始まる・止まる(遊びながら、音を切り替えられる)", () => {
    const { sound, ticker } = setup({ mode: "off" });
    sound.startBgm();
    assert.equal(sound.state.bgmPlaying, false, "なし → 鳴らない");
    sound.configure({ mode: "all", volume: 60 });
    sound.unlock();
    assert.equal(sound.state.bgmPlaying, true, "all にしたら、鳴り始める");
    sound.configure({ mode: "se", volume: 60 });
    assert.equal(sound.state.bgmPlaying, false, "効果音だけにしたら、BGM は止まる");
    assert.equal(ticker.count, 0);
    sound.configure({ mode: "all", volume: 60 });
    assert.equal(sound.state.bgmPlaying, true);
    sound.configure({ mode: "all", volume: 0 });
    assert.equal(sound.state.bgmPlaying, false, "音量 0 なら、止まる");
    sound.configure({ mode: "all", volume: 40 });
    assert.equal(sound.state.bgmPlaying, true, "音量を戻したら、続きから");
    sound.configure({ mode: "off", volume: 40 });
    assert.equal(sound.state.bgmPlaying, false);
  });

  it("stopBgm のあとは、設定を変えても、鳴り始めない", () => {
    const { sound } = setup({ mode: "se" });
    sound.startBgm();
    sound.stopBgm();
    sound.configure({ mode: "all", volume: 60 });
    assert.equal(sound.state.bgmPlaying, false);
  });
});

describe("タブが見えない間", () => {
  it("BGM を止め、音の準備を止める。戻ると、再開して、BGM も、続ける", () => {
    const { sound, context, ticker } = setup({ mode: "all" });
    sound.startBgm();
    sound.setHidden(true);
    assert.equal(sound.state.hidden, true);
    assert.equal(sound.state.bgmPlaying, false);
    assert.equal(ticker.count, 0);
    assert.equal(context.suspendCalls, 1);
    sound.setHidden(false);
    assert.equal(context.resumeCalls >= 1, true);
    assert.equal(sound.state.bgmPlaying, true);
  });

  it("BGM を流したくない状態で戻っても、鳴り始めない。音の準備がなくても、落ちない", () => {
    const { sound } = setup({ mode: "all" });
    sound.setHidden(true);
    sound.setHidden(false);
    assert.equal(sound.state.bgmPlaying, false);
    const off = setup({ mode: "off" });
    off.sound.setHidden(true);
    off.sound.setHidden(false);
    assert.equal(off.created(), 0);
  });
});

describe("音が使えない・失敗しても、落ちない", () => {
  it("AudioContext がない環境(createContext が null): 静かなまま。作り直しを、くり返さない", () => {
    let calls = 0;
    const sound = createSound({
      createContext: () => {
        calls += 1;
        return null;
      },
    });
    sound.configure({ mode: "all", volume: 60 });
    sound.unlock();
    assert.equal(sound.play("correct"), false);
    sound.startBgm();
    sound.play("miss");
    assert.equal(calls, 1);
    assert.equal(sound.state.unavailable, true);
    assert.equal(sound.state.bgmPlaying, false);
  });

  it("作るときに例外(createContext が throw): 静かなまま", () => {
    let calls = 0;
    const sound = createSound({
      createContext: () => {
        calls += 1;
        throw new Error("blocked");
      },
    });
    sound.configure({ mode: "se", volume: 60 });
    assert.doesNotThrow(() => sound.unlock());
    assert.equal(sound.play("start"), false);
    assert.equal(calls, 1);
  });

  it("音を作る途中で例外(oscillator が作れない): play は false。落ちない", () => {
    const { context } = fakeContext();
    context.createOscillator = () => {
      throw new Error("no oscillator");
    };
    const sound = createSound({ createContext: () => context });
    sound.configure({ mode: "se", volume: 60 });
    assert.equal(sound.play("correct"), false);
  });

  it("BGM の予約の途中で例外: BGM だけ止まり、落ちない", () => {
    const { context } = fakeContext({ state: "running" });
    const ticker = fakeTicker();
    let fail = false;
    const original = context.createOscillator.bind(context);
    context.createOscillator = () => {
      if (fail) throw new Error("boom");
      return original();
    };
    const sound = createSound({
      createContext: () => context,
      setTick: ticker.setTick,
      clearTick: ticker.clearTick,
    });
    sound.configure({ mode: "all", volume: 60 });
    sound.startBgm();
    fail = true;
    context.currentTime += 3;
    assert.doesNotThrow(() => ticker.tick());
    assert.equal(sound.state.bgmPlaying, false);
    assert.equal(ticker.count, 0);
  });

  it("再開(resume)が拒否されても、未処理の失敗にならない", async () => {
    const rejected = Promise.reject(new Error("not allowed"));
    const { context } = fakeContext({ resumeResult: rejected });
    const sound = createSound({ createContext: () => context });
    sound.configure({ mode: "se", volume: 60 });
    sound.unlock();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(context.resumeCalls, 1);
  });

  it("再開・停止が例外を投げても、落ちない", () => {
    const { context } = fakeContext();
    context.resume = () => {
      throw new Error("bad");
    };
    context.suspend = () => {
      throw new Error("bad");
    };
    const sound = createSound({ createContext: () => context });
    sound.configure({ mode: "se", volume: 60 });
    assert.doesNotThrow(() => sound.unlock());
    assert.doesNotThrow(() => sound.setHidden(true));
    assert.doesNotThrow(() => sound.setHidden(false));
  });
});

describe("audio.js は、DOM・保存・通信・音のファイルに触れない", () => {
  it("document・window・storage・fetch・Audio 要素・音のファイルを、使わない", () => {
    const source = read("public/assets/js/games/escape-boss/audio.js");
    assert.ok(
      !/\b(document|window|localStorage|sessionStorage|fetch|XMLHttpRequest|new Audio)\b/.test(
        source,
      ),
    );
    assert.ok(!/\.(mp3|wav|ogg|m4a|aac|flac|webm)\b/i.test(source));
    assert.ok(!/decodeAudioData|createMediaElementSource|createBufferSource/.test(source));
  });
});
