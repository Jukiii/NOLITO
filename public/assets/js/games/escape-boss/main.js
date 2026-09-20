import { availableTitles, evaluateAchievements, titleName as titleNameOf } from "./achievements.js";
import { applyCorrect, applyHit, applyMiss, createGameState, tick } from "./engine.js";
import { attachInput } from "./input.js";
import {
  createKeyStats,
  mostMissedKeys,
  recordHit,
  recordMiss,
  topConfusions,
} from "./keystats.js";
import {
  getRanking,
  isRoleUnlocked,
  recordResult,
  unlockAchievements,
  updateProfile,
} from "./records.js";
import { createMatcher } from "./romaji.js";
import { summarize } from "./score.js";
import { createStore, getBackend } from "./storage.js";
import { loadJobs, loadRoles, loadVocabulary, pickWords } from "./vocabulary.js";
import { createView } from "./view.js";

// 1フレームで進める時間の上限(重い処理や一時停止からの復帰で距離が一気に減らないようにする)
const MAX_FRAME_SECONDS = 0.1;
const DEFAULT_ROLE_ID = "senpai";

const view = createView(document.querySelector("[data-game]"));
const store = createStore(getBackend());

let jobs = [];
let roles = [];
let config = { default_title: { id: "newbie", name: "新入社員" }, achievements: [] };
let rankingRoleId = DEFAULT_ROLE_ID;
let storageNotice = "";
let session = null;

const jobsById = () => Object.fromEntries(jobs.map((job) => [job.id, job.name]));

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} (${response.status})`);
  return response.json();
}

// 保存の状態に応じた案内(保存できない・壊れていた・書き込みに失敗した)を決める
function noticeFor(status, saved = true) {
  if (status === "unavailable") return "unavailable";
  if (status === "corrupt") return "corrupt";
  return saved ? "" : "failed";
}

function refreshDashboard() {
  const { data } = store.load();
  const titles = availableTitles(config, data.achievements);
  view.renderDashboard({
    jobs,
    roles,
    isUnlocked: (role) => isRoleUnlocked(data, role),
    profile: {
      nickname: data.profile.nickname,
      titleId: titles.some((title) => title.id === data.profile.titleId)
        ? data.profile.titleId
        : config.default_title.id,
    },
    titles,
    rankingRoleId,
    ranking: getRanking(data, rankingRoleId),
    jobsById: jobsById(),
    achievements: config.achievements,
    unlocked: data.achievements,
    storageNotice,
  });
}

async function init() {
  try {
    [jobs, roles, config] = await Promise.all([
      loadJobs(),
      loadRoles(),
      loadJson("/data/achievements.json"),
    ]);
  } catch {
    view.showError("データを読み込めませんでした。ページを再読み込みしてください。");
    return;
  }
  const { status } = store.load();
  storageNotice = noticeFor(status);
  view.bind({
    onStart: startGame,
    onProfileChange: handleProfileChange,
    onRankingRoleChange: (roleId) => {
      rankingRoleId = roleId;
      view.renderRanking({ entries: getRanking(store.load().data, roleId), jobsById: jobsById() });
    },
    onRetry: () => session && startGame({ jobId: session.job.id, roleId: session.role.id }),
    onBack: quit,
    onQuit: quit,
  });
  refreshDashboard();
}

function handleProfileChange({ nickname, titleId }) {
  const out = store.update((data) => {
    const ids = availableTitles(config, data.achievements).map((title) => title.id);
    return { data: updateProfile(data, { nickname, titleId }, ids) };
  });
  view.setNickname(out.data.profile.nickname);
  storageNotice = noticeFor(store.status, out.saved);
  view.announce(out.saved ? "保存しました。" : "この端末では保存できません。");
}

let starting = false;

// 開始の処理。語録の読み込みを待つ間に、もう一度押されても(2度押し・連打)、2本目を始めない。
// 2本目を許すと、アニメーションの処理が2本並行して走り続けてしまう。
async function startGame(options) {
  if (starting || session?.state.status === "playing") return;
  starting = true;
  try {
    await beginGame(options);
  } finally {
    starting = false;
  }
}

async function beginGame({ jobId, roleId }) {
  const job = jobs.find((j) => j.id === jobId);
  const role = roles.find((r) => r.id === roleId);
  if (!job || !role) return;
  if (!isRoleUnlocked(store.load().data, role)) {
    view.showError("この役職には、まだ挑戦できません。");
    return;
  }
  let vocabulary;
  try {
    vocabulary = await loadVocabulary(jobId);
  } catch {
    view.showError("語録を読み込めませんでした。時間をおいてもう一度お試しください。");
    return;
  }
  view.showError("");

  const stage = role.stage;
  const words = pickWords(vocabulary.items, role.id, stage.goal_words);
  // 前のゲームの処理が残っていれば、必ず止めてから、新しいゲームに置き換える
  if (session) cancelAnimationFrame(session.frameId);
  session = {
    job,
    role,
    stage,
    vocabularyVersion: vocabulary.version,
    words,
    index: 0,
    matcher: createMatcher(words[0].reading),
    state: createGameState(stage),
    keyStats: createKeyStats(),
    lastFrame: performance.now(),
    frameId: 0,
  };
  view.showPlay({ jobName: job.name, role, goal: stage.goal_words });
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

// 結果を記録し、ランキング・実績を更新して、結果画面を出す
function finish() {
  cancelAnimationFrame(session.frameId);
  const { state, stage, job, role } = session;
  const { accuracy, cps, score } = summarize(state, role.score_multiplier);
  const result = {
    playedAt: Date.now(),
    jobId: job.id,
    roleId: role.id,
    status: state.status,
    score,
    correct: state.correct,
    miss: state.miss,
    hits: state.hits,
    elapsed: state.elapsed,
    distance: Math.round(Math.max(0, state.distance) * 10) / 10,
    accuracy,
    cps,
    vocabularyVersion: session.vocabularyVersion,
    // ミス分析・苦手文字の元データ(キーごとの集計・打ち間違いの組・語ごとのミス数)
    keys: session.keyStats.keys,
    confusions: session.keyStats.confusions,
    wordMisses: session.keyStats.wordMisses,
  };

  const before = store.load().data;
  const out = store.update((data) => {
    const titleIds = availableTitles(config, data.achievements).map((title) => title.id);
    const titleId = titleIds.includes(data.profile.titleId)
      ? data.profile.titleId
      : config.default_title.id;
    const { data: recorded, rank } = recordResult(data, result, {
      titleName: titleNameOf(config, titleId),
    });
    const ids = evaluateAchievements({
      definitions: config.achievements,
      unlocked: recorded.achievements,
      progress: recorded.progress,
      result,
      jobIds: jobs.map((j) => j.id),
    });
    return { data: unlockAchievements(recorded, ids, result.playedAt), rank, ids };
  });

  const newAchievements = out.ids.map((id) => config.achievements.find((a) => a.id === id));
  const kaicho = roles.find((r) => r.unlock);
  const kaichoUnlocked = Boolean(
    kaicho && !isRoleUnlocked(before, kaicho) && isRoleUnlocked(out.data, kaicho),
  );
  storageNotice = noticeFor(store.status, out.saved);
  rankingRoleId = role.id;

  view.showResult({
    state,
    stage,
    jobName: job.name,
    roleName: role.name,
    score,
    accuracy,
    rank: out.rank,
    newAchievements,
    kaichoUnlocked,
    notice: storageNotice,
    analysis: {
      misses: state.miss,
      keys: mostMissedKeys(session.keyStats, 3),
      confusions: topConfusions(session.keyStats, 3),
    },
  });
  const cleared = state.status === "cleared";
  const extras = [
    cleared ? "ステージクリア。逃げ切りました。" : "ゲームオーバー。",
    `スコアは${score}点。`,
    cleared && out.rank ? `ランキング${out.rank}位。` : "",
    newAchievements.length > 0
      ? `新しい実績: ${newAchievements.map((a) => a.name).join("、")}。`
      : "",
    kaichoUnlocked ? "会長に挑戦できるようになりました。" : "",
  ];
  view.announce(extras.filter(Boolean).join(""));
}

function handleChar(char) {
  if (!session || session.state.status !== "playing") return;
  // 打鍵の集計は、結果を確定する(finish が呼ばれる)前に済ませる。最後の1打も記録に入れるため。
  const key = char.toLowerCase();
  const expected = session.matcher.remaining.charAt(0);
  const word = session.words[session.index];
  const result = session.matcher.input(char);
  if (result === "miss") {
    session.keyStats = recordMiss(session.keyStats, expected, key, word.id);
    view.flashMiss();
    update(applyMiss(session.state, session.stage));
    return;
  }
  session.keyStats = recordHit(session.keyStats, key);
  session.state = applyHit(session.state);
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
  refreshDashboard();
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

init();
