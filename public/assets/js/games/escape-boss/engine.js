// 距離・クリア判定のゲームロジック。DOM に依存せず、状態は不変(毎回新しいオブジェクトを返す)。
// stage は roles.json の stage(max_distance / initial_distance / drain_per_second /
// base_gain / gain_per_char / miss_penalty / goal_words / difficulty_gain / speed_gain /
// speed_min_cps / speed_max_cps)。難易度・速さの項目がない stage は、その分を 0 として扱う。
// stage.rules(特殊ルール。rules.js)があれば、時間による距離の減り方に、倍率をかける。なければ、従来どおり。

import { drainMultiplier, rulesOf, shockDuration } from "./rules.js";

export function createGameState(stage) {
  return {
    status: "playing",
    distance: stage.initial_distance,
    correct: 0,
    miss: 0,
    hits: 0,
    elapsed: 0,
    // いまの語で、ミスをしたか(次の語に進むと false に戻る)。連続ノーミスの判定に使う
    wordMissed: false,
    // ミスなしで打ち終えた語の、いまの連続数と、このプレイでの最高
    streak: 0,
    bestStreak: 0,
    // 打ち終えた語の、難易度ごとの数({ "1": 3, "2": 5 } のように。打った語だけが入る)
    byDifficulty: {},
    // 「ミスで加速」が終わるゲーム内の経過秒(0 = 働いていない)
    shockUntil: 0,
  };
}

// クリア判定を優先する(最後の1語を打ち終えた瞬間は、距離が 0 でも逃げ切りとする)
function settle(state, stage) {
  if (state.correct >= stage.goal_words) return { ...state, status: "cleared" };
  if (state.distance <= 0) return { ...state, status: "gameover", distance: 0 };
  return state;
}

// ルールで、減る速さが途中で変わるときの、時間の刻み(秒)。画面は 0.1 秒以下ずつ進めるので、それより細かく
const SUBSTEP_SECONDS = 0.05;

// 時間経過。追跡者が近づくため距離が減る。ルールがあれば、減る速さは、その間の倍率で変わる(刻みごとに計算)。
export function tick(state, stage, seconds) {
  if (state.status !== "playing") return state;
  if (!Number.isFinite(seconds) || seconds < 0) return state;
  const rules = rulesOf(stage);
  let distance = state.distance;
  if (rules.length === 0) {
    distance -= stage.drain_per_second * seconds;
  } else {
    const steps = Math.max(1, Math.ceil(seconds / SUBSTEP_SECONDS));
    const dt = seconds / steps;
    for (let i = 0; i < steps && distance > 0; i += 1) {
      const multiplier = drainMultiplier(
        rules,
        { elapsed: state.elapsed + (i + 0.5) * dt, distance, shockUntil: state.shockUntil },
        stage.max_distance,
      );
      distance -= stage.drain_per_second * multiplier * dt;
    }
  }
  return settle({ ...state, distance, elapsed: state.elapsed + seconds }, stage);
}

// 語の難易度の範囲(語録の決め。0006)。範囲の外の値は、範囲に収める
const DIFFICULTY_MIN = 1;
const DIFFICULTY_MAX = 5;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * 1 語を打った速さ(打鍵/秒)。最初の正しい打鍵から最後の打鍵までの間隔(打鍵数 - 1)を、
 * かかった秒数で割る。秒数が 0 以下・数でない、打鍵数が 2 未満のときは 0(速さの加点なし)。
 */
export function typingSpeed(keystrokes, seconds) {
  if (!Number.isFinite(keystrokes) || !Number.isFinite(seconds)) return 0;
  if (keystrokes < 2 || seconds <= 0) return 0;
  return (keystrokes - 1) / seconds;
}

/** 難易度による増分: difficulty_gain × (難易度 - 1)。難易度 1・不明なら 0。 */
export function difficultyGain(stage, difficulty) {
  const gain = stage.difficulty_gain ?? 0;
  if (!(gain > 0) || !Number.isFinite(difficulty)) return 0;
  return gain * (clamp(difficulty, DIFFICULTY_MIN, DIFFICULTY_MAX) - DIFFICULTY_MIN);
}

/**
 * 速さによる増分: speed_gain × (min〜max の間で 0〜1 に収めた速さの割合)。
 * min 以下は 0、max 以上は speed_gain(上限)。加算だけで、遅くても減らない。
 */
export function speedGain(stage, keystrokes, seconds) {
  const gain = stage.speed_gain ?? 0;
  const range = (stage.speed_max_cps ?? 0) - (stage.speed_min_cps ?? 0);
  if (!(gain > 0) || !(range > 0)) return 0;
  const ratio = (typingSpeed(keystrokes, seconds) - stage.speed_min_cps) / range;
  return gain * clamp(ratio, 0, 1);
}

/**
 * 1語の正解で増える距離 = 基本 + 文字数の分 + 難易度の分 + 速さの分。
 * options(難易度 difficulty・打った秒数 seconds・実際に打った打鍵数 keystrokes。
 * 打鍵数がなければ charCount)がなければ、文字数の分までを返す。
 * 文字数の分は表示用の標準の表記の長さ、速さは、実際に打った打鍵数で数える(si と shi など、書き方の違いに左右されない)。
 */
export function wordGain(stage, charCount, options = {}) {
  return (
    stage.base_gain +
    stage.gain_per_char * charCount +
    difficultyGain(stage, options.difficulty) +
    speedGain(stage, options.keystrokes ?? charCount, options.seconds)
  );
}

// 難易度ごとの語数に、1 語を加える。語録の範囲(1〜5)の整数だけを数える
function tallyDifficulty(byDifficulty, difficulty) {
  if (!Number.isInteger(difficulty) || difficulty < DIFFICULTY_MIN || difficulty > DIFFICULTY_MAX) {
    return byDifficulty;
  }
  const key = String(difficulty);
  return { ...byDifficulty, [key]: (byDifficulty[key] ?? 0) + 1 };
}

export function applyCorrect(state, stage, charCount, options = {}) {
  if (state.status !== "playing") return state;
  const distance = Math.min(
    stage.max_distance,
    state.distance + wordGain(stage, charCount, options),
  );
  // ミスなしで打ち終えた語だけが、連続に数えられる。ミスのあった語は、連続を 0 に戻す
  const streak = state.wordMissed ? 0 : state.streak + 1;
  return settle(
    {
      ...state,
      distance,
      correct: state.correct + 1,
      wordMissed: false,
      streak,
      bestStreak: Math.max(state.bestStreak, streak),
      byDifficulty: tallyDifficulty(state.byDifficulty, options.difficulty),
    },
    stage,
  );
}

// 正しい打鍵1回。正確率・打鍵速度の計算に使う。
export function applyHit(state) {
  if (state.status !== "playing") return state;
  return { ...state, hits: state.hits + 1 };
}

export function applyMiss(state, stage) {
  if (state.status !== "playing") return state;
  // ミスした時点で、連続は途切れる(その語を打ち終えても、連続には数えない)
  // 「ミスで加速」があれば、ミスした瞬間から、その時間の間、加速する(続けてミスすると、そのたびに延びる)
  const shock = shockDuration(rulesOf(stage));
  return settle(
    {
      ...state,
      distance: state.distance - stage.miss_penalty,
      miss: state.miss + 1,
      wordMissed: true,
      streak: 0,
      shockUntil: shock > 0 ? Math.max(state.shockUntil, state.elapsed + shock) : state.shockUntil,
    },
    stage,
  );
}
