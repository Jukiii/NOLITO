// キーみち: 練習モード(ルートの手順を、順番どおりに、キーを押して練習する)の状態の遷移。DOM に依存しない。
// どの関数も、渡された練習(session)を書き換えず、新しい session を返す。
//
// 練習は、開始した時点の手順の写し(steps)で進む。練習のあいだに、ルート・操作を変えても、練習には影響しない。
// 結果は、保存しない(その場の結果を、終了時に見せるだけ)。
//
// 手順の答え方(mode):
//   press … キーを押して判定する
//   self  … 答えを見て、自分で「できた / できなかった」を選ぶ(自己確認)
// 自己確認になる理由(selfReason):
//   method   … 練習の方法として、自己確認を選んだ
//   reserved … ブラウザ・OS が先に処理するキーで、ページに届かない(押すと、タブが閉じるなどする)
//   tab      … Tab・Shift+Tab は、画面の移動に使うため、判定しない(キーボードだけの人が、練習から出られるように)
//   marked   … 練習中に、「押しても反応しない」と、利用者が自己確認にした
import { chordsEqual, formatKeys, reservedReason } from "./keys.js";
import { resolveRoute } from "./model.js";

export const METHODS = ["press", "self"];

const fail = (error, message) => ({ ok: false, error, message });

// Tab・Shift+Tab(Ctrl・Alt・Win なしの Tab)は、判定しない
const isPlainTab = (chord) => chord.key === "Tab" && !chord.ctrl && !chord.alt && !chord.meta;

/** 手順の答え方。{ mode: "press" | "self", selfReason: null | "method" | "reserved" | "tab" } */
export function classifyKeys(keys, os, method) {
  if (method === "self") return { mode: "self", selfReason: "method" };
  if (keys.some((chord) => reservedReason(chord, os)))
    return { mode: "self", selfReason: "reserved" };
  if (keys.some(isPlainTab)) return { mode: "self", selfReason: "tab" };
  return { mode: "press", selfReason: null };
}

/**
 * 練習を始める。options: { os, method: "press" | "self", showKeys: boolean }。
 * { ok: true, session } か { ok: false, error, message }。
 */
export function startSession(
  data,
  routeId,
  { os = "windows", method = "press", showKeys = false } = {},
) {
  const route = data.routes.find((item) => item.id === routeId);
  if (!route) return fail("route-not-found", "ルートが見つかりません。");
  if (route.steps.length === 0) return fail("route-empty", "このルートには、手順がありません。");
  if (!METHODS.includes(method)) return fail("method-invalid", "練習の方法が正しくありません。");
  const steps = resolveRoute(data, route).map(({ app, operation }) => ({
    operationId: operation.id,
    appName: app.name,
    name: operation.name,
    note: operation.note,
    keys: operation.keys,
    keysText: formatKeys(operation.keys, os),
    ...classifyKeys(operation.keys, os, method),
    result: null, // ok / skipped / self-ok / self-ng
    misses: 0,
    hinted: false,
  }));
  const session = {
    routeId,
    routeName: route.name,
    os,
    method,
    showKeys: Boolean(showKeys),
    steps,
    index: 0,
    progress: 0, // 順に押すキーが、いくつ合っているか
    revealed: false,
    last: null, // 直近の判定({ type, pressed? })
    status: "running",
  };
  return { ok: true, session: { ...session, revealed: initiallyRevealed(session, 0) } };
}

// キーを最初から表示するのは、キーを押して判定する手順だけ(自己確認では、答えを隠したままにする)
const initiallyRevealed = (session, index) =>
  session.showKeys && session.steps[index].mode === "press";

export const currentStep = (session) =>
  session.status === "running" ? session.steps[session.index] : null;

const replaceStep = (session, index, change) => ({
  ...session,
  steps: session.steps.map((step, i) => (i === index ? { ...step, ...change } : step)),
});

// いまの手順を終えて、次へ(最後なら終了)
function advance(session, change) {
  const done = replaceStep(session, session.index, change);
  const next = session.index + 1;
  if (next >= session.steps.length) {
    return {
      ...done,
      index: session.steps.length,
      progress: 0,
      revealed: false,
      status: "finished",
    };
  }
  return { ...done, index: next, progress: 0, revealed: initiallyRevealed(done, next) };
}

/**
 * キーを押した。chord は keys.js の chord(押したキー)。
 * { session, outcome }。outcome は
 *   ignored   … 練習中でない・自己確認の手順(判定しない)
 *   partial   … 順に押すキーの途中まで合っている
 *   step-done … その手順が合った(次の手順へ)
 *   finished  … 最後の手順が合った(練習が終わった)
 *   miss      … 違う(間違いを1つ数え、その手順の最初のキーからやり直す)
 * 順に押す途中で違うキーを押したときに、それが最初のキーと同じなら、そこから数え直す。
 */
export function pressChord(session, chord) {
  const step = currentStep(session);
  if (!step || step.mode !== "press") return { session, outcome: "ignored" };
  if (chordsEqual(step.keys[session.progress], chord)) {
    const progress = session.progress + 1;
    if (progress < step.keys.length) {
      return {
        session: { ...session, progress, last: { type: "partial", pressed: chord } },
        outcome: "partial",
      };
    }
    const next = advance(session, { result: "ok" });
    const outcome = next.status === "finished" ? "finished" : "step-done";
    return { session: { ...next, last: { type: outcome, pressed: chord } }, outcome };
  }
  const restart = chordsEqual(step.keys[0], chord) ? 1 : 0;
  const missed = replaceStep(session, session.index, { misses: step.misses + 1 });
  return {
    session: { ...missed, progress: restart, last: { type: "miss", pressed: chord } },
    outcome: "miss",
  };
}

/** 答えのキーを見る(ヒント)。キーを押して判定する手順では、ヒントを使ったと数える。 */
export function reveal(session) {
  const step = currentStep(session);
  if (!step || session.revealed) return session;
  const shown = { ...session, revealed: true, last: { type: "revealed" } };
  return step.mode === "press" ? replaceStep(shown, session.index, { hinted: true }) : shown;
}

/** 自己確認の手順で、「できた」(ok が true)か「できなかった」を選ぶ。 */
export function selfAnswer(session, ok) {
  const step = currentStep(session);
  if (!step || step.mode !== "self") return session;
  const result = ok ? "self-ok" : "self-ng";
  return {
    ...advance(session, { result, hinted: step.hinted || session.revealed }),
    last: { type: result },
  };
}

/** いまの手順を、飛ばす。 */
export function skip(session) {
  if (!currentStep(session)) return session;
  return { ...advance(session, { result: "skipped" }), last: { type: "skipped" } };
}

/** 「押しても反応しない」: いまの手順を、自己確認にする(ブラウザ・OS が先に処理するキーの、目安が外れたときのため)。 */
export function markSelfCheck(session) {
  const step = currentStep(session);
  if (!step || step.mode !== "press") return session;
  const marked = replaceStep(session, session.index, { mode: "self", selfReason: "marked" });
  return { ...marked, progress: 0, revealed: false, last: { type: "marked" } };
}

/** 結果の集計。 */
export function summarize(session) {
  const count = (result) => session.steps.filter((step) => step.result === result).length;
  const ok = count("ok");
  const selfOk = count("self-ok");
  return {
    total: session.steps.length,
    ok,
    selfOk,
    selfNg: count("self-ng"),
    skipped: count("skipped"),
    misses: session.steps.reduce((sum, step) => sum + step.misses, 0),
    hints: session.steps.filter((step) => step.hinted).length,
    // 間違いもヒントもなく、できた手順(自己確認の「できた」は、ヒントなしのときだけ)
    clean: session.steps.filter(
      (step) =>
        (step.result === "ok" || step.result === "self-ok") && step.misses === 0 && !step.hinted,
    ).length,
    steps: session.steps.map((step) => ({
      appName: step.appName,
      name: step.name,
      keysText: step.keysText,
      result: step.result,
      misses: step.misses,
      hinted: step.hinted,
      mode: step.mode,
      selfReason: step.selfReason,
    })),
  };
}
