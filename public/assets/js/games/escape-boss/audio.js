// 音を鳴らす(Phase 16 PR 3)。ブラウザの Web Audio で、音をその場で合成する(ファイル・通信は、なし)。
// 何の音を鳴らすか・音量の計算は sound.js。ここは、鳴らす係だけ(DOM・保存には触れない)。
// 音を出す準備(AudioContext)は、設定が「なし」の間は、作らない。ブラウザの決まりで、操作(クリック・キー)のあとに作る。
// 音が使えない環境・失敗しても、落ちず、静かなままにする。

import {
  BGM_GAIN,
  BGM_STEP_SEC,
  DEFAULT_SOUND_MODE,
  DEFAULT_VOLUME,
  bgmStepNotes,
  effectNotes,
  isAudible,
  isSoundMode,
  masterGain,
  normalizeVolume,
} from "./sound.js";
import { DANGER_TEMPO_BOOST } from "./role-sound.js";

const LOOKAHEAD_SEC = 0.5; // BGM を、これだけ先まで、予約しておく
const TICK_MS = 100; // BGM の予約を見直す間隔
const MIN_REPLAY_SEC = 0.06; // 同じ効果音を、これより短い間隔では、重ねない(連打でも、うるさくならない)
const ATTACK_SEC = 0.01; // 音の立ち上がり(プチッという雑音を避ける)
const FADE_SEC = 0.06; // BGM を止めるときの、消え方

function defaultCreateContext() {
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return Context ? new Context() : null;
}

export function createSound({
  createContext = defaultCreateContext,
  setTick = (fn, ms) => globalThis.setInterval(fn, ms),
  clearTick = (id) => globalThis.clearInterval(id),
} = {}) {
  let mode = DEFAULT_SOUND_MODE;
  let volume = DEFAULT_VOLUME;
  let context = null;
  let master = null;
  let unavailable = false; // 音を作れない環境(以後、作ろうとしない)
  let hidden = false; // タブが見えない間
  let bgmWanted = false; // 呼び出し側が、BGM を流したい状態
  let bgmTimer = null;
  let bgmBus = null;
  let bgmStep = 0;
  let bgmNextAt = 0;
  // 役職ごとの音の個性(Phase 23 PR 1)。tempo・pitch は setRoleSound で、危ない状況の倍率は setDanger で設定する
  let roleTempo = 1;
  let rolePitch = 1;
  let dangerBoost = 1;
  const effectiveTempo = () => roleTempo * dangerBoost;
  const lastPlayed = new Map();

  function ensureContext() {
    if (context) return context;
    if (unavailable) return null;
    try {
      context = createContext();
      if (!context) {
        unavailable = true;
        return null;
      }
      master = context.createGain();
      const compressor = context.createDynamicsCompressor(); // 大きな音が重なっても、割れないように
      master.connect(compressor);
      compressor.connect(context.destination);
      applyVolume();
      return context;
    } catch {
      context = null;
      master = null;
      unavailable = true;
      return null;
    }
  }

  function applyVolume() {
    if (master) master.gain.value = masterGain(volume);
  }

  function resume() {
    try {
      if (context?.state === "suspended") context.resume()?.catch?.(() => {});
    } catch {
      // 再開できなくても、静かなままにする
    }
  }

  // 音符を、時刻 base からの予約で、鳴らす(dest は、つなぐ先)
  function schedule(notes, base, dest) {
    for (const item of notes) {
      const start = base + item.at;
      const end = start + item.sec;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = item.wave;
      oscillator.frequency.setValueAtTime(item.hz, start);
      if (item.to) oscillator.frequency.linearRampToValueAtTime(item.to, end);
      const attack = Math.min(ATTACK_SEC, item.sec / 2);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(item.gain, start + attack);
      gain.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(gain);
      gain.connect(dest);
      oscillator.start(start);
      oscillator.stop(end + 0.03);
    }
  }

  function tickBgm() {
    if (!context || bgmTimer === null) return;
    try {
      while (bgmNextAt < context.currentTime + LOOKAHEAD_SEC) {
        schedule(bgmStepNotes(bgmStep, rolePitch), bgmNextAt, bgmBus);
        bgmStep += 1;
        // 速さ(tempo)は、拍の間隔を詰める・広げることで表す。危ない状況の倍率(dangerBoost)も、ここでかかる
        bgmNextAt += BGM_STEP_SEC / effectiveTempo();
      }
    } catch {
      haltBgm();
    }
  }

  function beginBgm(delaySec) {
    const c = ensureContext();
    if (!c) return;
    try {
      bgmBus = c.createGain();
      bgmBus.gain.value = BGM_GAIN;
      bgmBus.connect(master);
      bgmStep = 0;
      bgmNextAt = c.currentTime + Math.max(0, delaySec) + 0.05;
      bgmTimer = setTick(tickBgm, TICK_MS);
      tickBgm();
    } catch {
      haltBgm();
    }
  }

  // BGM の予約を止め、すでに予約した音も、すっと消す
  function haltBgm() {
    if (bgmTimer !== null) clearTick(bgmTimer);
    bgmTimer = null;
    if (bgmBus && context) {
      try {
        const now = context.currentTime;
        bgmBus.gain.cancelScheduledValues?.(now);
        bgmBus.gain.setValueAtTime(bgmBus.gain.value, now);
        bgmBus.gain.linearRampToValueAtTime(0, now + FADE_SEC);
      } catch {
        // 消せなくても、予約した音は、短いので、そのうち終わる
      }
    }
    bgmBus = null;
  }

  // 「流したい」状態・設定・タブの見え方に合わせて、BGM を、始める・止める
  function syncBgm(delaySec = 0) {
    const wanted = bgmWanted && !hidden && isAudible(mode, "bgm", volume);
    if (wanted && bgmTimer === null) beginBgm(delaySec);
    else if (!wanted && bgmTimer !== null) haltBgm();
  }

  return {
    /** 設定を反映する(不正な値は、既定)。音量は、すぐ変わる。BGM は、設定に合わせて、始まる・止まる */
    configure({ mode: nextMode, volume: nextVolume } = {}) {
      mode = isSoundMode(nextMode) ? nextMode : DEFAULT_SOUND_MODE;
      volume = normalizeVolume(nextVolume);
      applyVolume();
      syncBgm();
    },

    /** 操作(クリック・キー)の中で呼ぶ。設定が「なし」なら、何も作らない。音の準備をして、止まっていれば再開する */
    unlock() {
      if (mode === DEFAULT_SOUND_MODE) return;
      if (ensureContext()) resume();
    },

    /** 効果音を鳴らす。鳴らしたら true(設定が「なし」・音量 0・知らない名前・連打・音が使えない環境では、false) */
    play(name) {
      if (!isAudible(mode, "se", volume)) return false;
      const notes = effectNotes(name, rolePitch);
      if (!notes) return false;
      const c = ensureContext();
      if (!c) return false;
      try {
        const previous = lastPlayed.get(name);
        if (previous !== undefined && c.currentTime - previous < MIN_REPLAY_SEC) return false;
        lastPlayed.set(name, c.currentTime);
        resume();
        schedule(notes, c.currentTime + 0.01, master);
        return true;
      } catch {
        return false;
      }
    },

    /** BGM を流したい(設定が「効果音 + BGM」のときだけ、鳴る)。delaySec だけ待って始める */
    startBgm({ delaySec = 0 } = {}) {
      bgmWanted = true;
      syncBgm(delaySec);
    },

    stopBgm() {
      bgmWanted = false;
      syncBgm();
    },

    /**
     * 役職ごとの音の個性(Phase 23 PR 1)。ゲーム開始のたびに、1 回呼ぶ(危ない状況の倍率は、既定に戻す)。
     * 不正な値は、既定(1)にする(呼び出し側の role-sound.js の roleSoundOf が、すでに範囲を検査しているが、
     * ここでも、壊れた値で音が壊れないよう、念のため確認する)。
     */
    setRoleSound({ tempo = 1, pitch = 1 } = {}) {
      roleTempo = Number.isFinite(tempo) && tempo > 0 ? tempo : 1;
      rolePitch = Number.isFinite(pitch) && pitch > 0 ? pitch : 1;
      dangerBoost = 1;
    },

    /** 「危ない」状況(scene.js の isDanger と同じ判断)の間、BGM を、少し速くする */
    setDanger(active) {
      dangerBoost = active ? DANGER_TEMPO_BOOST : 1;
    },

    /** タブが見えない間は、BGM を止め、音の準備も止める(戻ったら、続ける) */
    setHidden(value) {
      hidden = Boolean(value);
      try {
        if (hidden) context?.suspend?.()?.catch?.(() => {});
        else resume();
      } catch {
        // 止められなくても、続ける
      }
      syncBgm();
    },

    /** いまの状態(テスト・画面の表示用) */
    get state() {
      return {
        mode,
        volume,
        ready: context !== null,
        unavailable,
        bgmPlaying: bgmTimer !== null,
        hidden,
      };
    },
  };
}
