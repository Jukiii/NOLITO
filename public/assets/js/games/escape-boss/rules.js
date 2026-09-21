// 役職の特殊ルール(Phase 17)。DOM・時計・乱数・保存に触れない純粋な計算。
// ルールは roles.json の stage.rules に、データで書く(種類 + 数値)。どれも、「追ってくる人が、時間で距離を縮める速さ」
// (drain_per_second)にかける倍率で、加算・減算はしない。engine.js の tick が使う。値は、あとから直せる。
//
// 種類:
//   surge   … ダッシュ。every 秒ごとの周期の終わりの duration 秒だけ、multiplier 倍になる。始まる warn 秒前から、予告
//   shock   … ミスで加速。ミスした瞬間から duration 秒間、multiplier 倍になる
//   closing … 追い詰め。距離が、最大距離の from(割合)を切ると、少なくなるほど速くなり、距離 0 で max 倍になる

export const RULE_TYPES = Object.freeze(["surge", "shock", "closing"]);

// 全部のルールを、かけ合わせた倍率の上限(重なっても、極端な速さにならない)
export const MAX_DRAIN_MULTIPLIER = 3;

// 数値の範囲(これを外れたルールは、無効として、無視する。roles.json は、テストで、範囲内を検査する)
export const RULE_LIMITS = Object.freeze({
  surge: Object.freeze({
    every: [8, 60],
    duration: [1, 10],
    warn: [0, 3],
    multiplier: [1.1, 3],
  }),
  shock: Object.freeze({ duration: [0.5, 10], multiplier: [1.1, 3] }),
  closing: Object.freeze({ from: [0.1, 0.9], max: [1.05, 2.5] }),
});

const inRange = (value, [min, max]) => Number.isFinite(value) && value >= min && value <= max;

/**
 * ルール 1 つを、検証して、整える。無効(知らない種類・範囲外・数でない・ダッシュの周期に、予告と時間が入らない)なら null。
 * 知らない項目は、捨てる(入力を書き換えない)。warn は、省略すると 1 秒。
 */
export function normalizeRule(rule) {
  if (typeof rule !== "object" || rule === null || Array.isArray(rule)) return null;
  const type = rule.type;
  if (!RULE_TYPES.includes(type)) return null;
  const limits = RULE_LIMITS[type];
  const value = { ...rule };
  if (type === "surge" && value.warn === undefined) value.warn = 1;
  const result = { type };
  for (const key of Object.keys(limits)) {
    if (!inRange(value[key], limits[key])) return null;
    result[key] = value[key];
  }
  // ダッシュは、予告と本番が、1 周期の中に収まること(始まりが、周期をまたがない)
  if (type === "surge" && result.duration + result.warn >= result.every) return null;
  return result;
}

const cache = new WeakMap();

/** stage のルール(無効なものは除く。同じ種類は、最初の 1 つだけ)。stage ごとに、結果を覚える */
export function rulesOf(stage) {
  if (typeof stage !== "object" || stage === null) return [];
  const source = stage.rules;
  if (!Array.isArray(source)) return [];
  if (cache.has(source)) return cache.get(source);
  const seen = new Set();
  const rules = [];
  for (const raw of source) {
    const rule = normalizeRule(raw);
    if (rule && !seen.has(rule.type)) {
      seen.add(rule.type);
      rules.push(Object.freeze(rule));
    }
  }
  Object.freeze(rules);
  cache.set(source, rules);
  return rules;
}

/** ダッシュのいまの段階: "idle"(ふだん)/ "warn"(予告)/ "active"(ダッシュ中)。elapsed はゲーム内の経過秒 */
export function surgePhase(rule, elapsed) {
  if (rule?.type !== "surge" || !Number.isFinite(elapsed) || elapsed < 0) return "idle";
  const position = elapsed % rule.every;
  const startsAt = rule.every - rule.duration;
  if (position >= startsAt) return "active";
  if (position >= startsAt - rule.warn) return "warn";
  return "idle";
}

/** ミスで加速が、いま働いているか(shockUntil = 加速が終わる経過秒) */
export const isShockActive = (elapsed, shockUntil) =>
  Number.isFinite(elapsed) && Number.isFinite(shockUntil) && shockUntil > 0 && elapsed < shockUntil;

/** 追い詰めの倍率。距離の割合(distance ÷ 最大距離)が from 以上なら 1、0 で max。その間は、直線で増える */
export function closingMultiplier(rule, ratio) {
  if (rule?.type !== "closing" || !Number.isFinite(ratio)) return 1;
  const r = Math.min(1, Math.max(0, ratio));
  if (r >= rule.from) return 1;
  return 1 + (rule.max - 1) * ((rule.from - r) / rule.from);
}

/**
 * いまの、時間による距離の減り方にかける倍率(1 = ふだんどおり)。
 * state は { elapsed, distance, shockUntil }、maxDistance は最大距離。
 * 働いているルールの倍率を、かけ合わせる(MAX_DRAIN_MULTIPLIER まで)。
 */
export function drainMultiplier(rules, { elapsed, distance, shockUntil = 0 }, maxDistance) {
  let multiplier = 1;
  for (const rule of rules) {
    if (rule.type === "surge" && surgePhase(rule, elapsed) === "active") {
      multiplier *= rule.multiplier;
    } else if (rule.type === "shock" && isShockActive(elapsed, shockUntil)) {
      multiplier *= rule.multiplier;
    } else if (rule.type === "closing" && maxDistance > 0) {
      multiplier *= closingMultiplier(rule, distance / maxDistance);
    }
  }
  return Math.min(MAX_DRAIN_MULTIPLIER, multiplier);
}

/** ミスで加速の長さ(秒)。ルールがなければ 0 */
export const shockDuration = (rules) => rules.find((rule) => rule.type === "shock")?.duration ?? 0;

// ---- プレイ中の表示(Phase 17 PR 2) ----
// いま働いているルールを、画面に伝えるための「合図」。倍率の計算(drainMultiplier)と、同じ判断を使う。
//   surge-warn … ダッシュの予告 / surge … ダッシュ中 / shock … ミスで加速中 / closing … 追い詰め中(距離が from を切っている間)

export const CUE_ORDER = Object.freeze(["surge-warn", "surge", "shock", "closing"]);

// 合図の文字(色・動きだけに頼らず、文字でも伝える)
export const CUE_LABELS = Object.freeze({
  "surge-warn": "ダッシュ注意!",
  surge: "ダッシュ中!",
  shock: "ミスで加速中!",
  closing: "追い詰め中!",
});

/** 合図の文字。知らない合図は、空の文字(Object のもとからある名前も、通さない) */
export const cueLabel = (token) => (Object.hasOwn(CUE_LABELS, token) ? CUE_LABELS[token] : "");

/**
 * いま働いている(または、これから働く)ルールの合図の一覧(CUE_ORDER の順。なければ空)。
 * state は { elapsed, distance, shockUntil }、maxDistance は最大距離。
 */
export function activeCues(rules, { elapsed, distance, shockUntil = 0 }, maxDistance) {
  const found = new Set();
  for (const rule of rules ?? []) {
    if (rule.type === "surge") {
      const phase = surgePhase(rule, elapsed);
      if (phase === "warn") found.add("surge-warn");
      else if (phase === "active") found.add("surge");
    } else if (rule.type === "shock") {
      if (isShockActive(elapsed, shockUntil)) found.add("shock");
    } else if (rule.type === "closing" && maxDistance > 0) {
      if (closingMultiplier(rule, distance / maxDistance) > 1) found.add("closing");
    }
  }
  return CUE_ORDER.filter((token) => found.has(token));
}

// 表示用の数(小数の 0 を、落とす)
const num = (value) => String(Math.round(value * 100) / 100);

/** ルール 1 つの、利用者向けの説明(1 文)。数値は、データから作る */
export function describeRule(rule) {
  if (rule?.type === "surge") {
    return `${num(rule.every)}秒ごとに、${num(rule.duration)}秒間の「ダッシュ」で、追ってくる人が${num(rule.multiplier)}倍の速さになります(始まる前に、予告が出ます)。`;
  }
  if (rule?.type === "shock") {
    return `ミスをすると、${num(rule.duration)}秒間、追ってくる人が${num(rule.multiplier)}倍の速さになります。`;
  }
  if (rule?.type === "closing") {
    return `逃走距離が${num(rule.from * 100)}%を切ると、少なくなるほど追ってくる人が速くなります(距離 0 で${num(rule.max)}倍)。`;
  }
  return "";
}

/** 役職の特殊ルールの説明(1 つ 1 文の配列)。ルールがなければ、空の配列 */
export const describeRules = (stage) => rulesOf(stage).map(describeRule);
