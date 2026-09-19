import { applyCorrect, applyMiss, createGameState, tick } from "./engine.js";
import { attachInput } from "./input.js";
import { createMatcher } from "./romaji.js";
import { loadJobs, loadRoles, loadVocabulary, pickWords } from "./vocabulary.js";
import { createView } from "./view.js";

// Phase 2 は先輩の1ステージのみ。役職の選択は Phase 18。
const ROLE_ID = "senpai";
// 1フレームで進める時間の上限(重い処理や一時停止からの復帰で距離が一気に減らないようにする)
const MAX_FRAME_SECONDS = 0.1;

const root = document.querySelector("[data-game]");
const view = createView(root);

let jobs = [];
let role = null;
let session = null;

async function init() {
  try {
    const [loadedJobs, roles] = await Promise.all([loadJobs(), loadRoles()]);
    jobs = loadedJobs;
    role = roles.find((r) => r.id === ROLE_ID);
    if (!role) throw new Error(`役職 ${ROLE_ID} が見つかりません`);
  } catch {
    view.showError("データを読み込めませんでした。ページを再読み込みしてください。");
    return;
  }
  view.renderDashboard(jobs, { onStart: startGame });
}

async function startGame(jobId) {
  const job = jobs.find((j) => j.id === jobId);
  let vocabulary;
  try {
    vocabulary = await loadVocabulary(jobId);
  } catch {
    view.showError("語録を読み込めませんでした。時間をおいてもう一度お試しください。");
    return;
  }
  view.showError("");

  const stage = role.stage;
  const words = pickWords(vocabulary.items, ROLE_ID, stage.goal_words);
  session = {
    job,
    stage,
    words,
    index: 0,
    matcher: createMatcher(words[0].reading),
    state: createGameState(stage),
    lastFrame: performance.now(),
    frameId: 0,
  };
  view.showPlay({ jobName: job.name, roleName: role.name, goal: stage.goal_words });
  view.announce(`ゲーム開始。職種は${job.name}。${role.name}が追ってきます。`);
  view.renderWord(words[0], session.matcher);
  view.renderStats(session.state, stage);
  session.frameId = requestAnimationFrame(frame);
}

function frame(now) {
  if (!session || session.state.status !== "playing") return;
  const seconds = Math.min((now - session.lastFrame) / 1000, MAX_FRAME_SECONDS);
  session.lastFrame = now;
  update(tick(session.state, session.stage, seconds));
  if (session.state.status === "playing") session.frameId = requestAnimationFrame(frame);
}

function update(state) {
  session.state = state;
  view.renderStats(state, session.stage);
  if (state.status !== "playing") finish();
}

function finish() {
  cancelAnimationFrame(session.frameId);
  const { state, stage, job } = session;
  view.showResult({ state, stage, jobName: job.name, roleName: role.name });
  view.announce(
    state.status === "cleared" ? "ステージクリア。逃げ切りました。" : "ゲームオーバー。",
  );
}

function handleChar(char) {
  if (!session || session.state.status !== "playing") return;
  const result = session.matcher.input(char);
  if (result === "miss") {
    view.flashMiss();
    update(applyMiss(session.state, session.stage));
    return;
  }
  if (result === "ok") {
    view.renderWord(session.words[session.index], session.matcher);
    return;
  }
  // 1語打ち終わった
  const charCount = session.matcher.canonicalLength;
  update(applyCorrect(session.state, session.stage, charCount));
  if (session.state.status !== "playing") return;
  session.index += 1;
  session.matcher = createMatcher(session.words[session.index].reading);
  view.renderWord(session.words[session.index], session.matcher);
}

function quit() {
  if (session) cancelAnimationFrame(session.frameId);
  session = null;
  view.showDashboard();
}

// タブが見えない間は進めない(戻ったときに距離が減り切っているのを防ぐ)
document.addEventListener("visibilitychange", () => {
  if (!session || session.state.status !== "playing") return;
  if (document.hidden) {
    cancelAnimationFrame(session.frameId);
  } else {
    session.lastFrame = performance.now();
    session.frameId = requestAnimationFrame(frame);
  }
});

attachInput(view.input, { onChar: handleChar, onImeChange: view.showImeWarning });
view.onQuit(quit);
view.onBack(quit);
view.onRetry(() => session && startGame(session.job.id));

init();
