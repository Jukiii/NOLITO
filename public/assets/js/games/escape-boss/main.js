import { availableTitles, evaluateAchievements, titleName as titleNameOf } from "./achievements.js";
// アカウントの案内・オンラインランキング(Phase 19 PR 2・3)。アカウントの API クライアントを再利用する(重複させない)
import { fetchMe, fetchOnlineRanking, saveOnlineRanking } from "../../account/client.js";
import {
  checkHit,
  checkMiss,
  checkNext,
  createCheckState,
  missedWords,
  pickCheckWords,
  summarizeCheck,
} from "./check.js";
import { applyCorrect, applyHit, applyMiss, createGameState, tick } from "./engine.js";
import { createSound } from "./audio.js";
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
  grantExp,
  isRoleUnlocked,
  recordResult,
  unlockAchievements,
  updateProfile,
} from "./records.js";
import { levelOf } from "./levels.js";
import { jobMasteries } from "./mastery.js";
import { createLines, lineLevelOf } from "./lines.js";
import { createMatcher } from "./romaji.js";
import { buildReviewList, indexWords } from "./review.js";
import { roleSoundOf } from "./role-sound.js";
import { isDanger, outroStyleOf } from "./scene.js";
import { summarize } from "./score.js";
import { toggledMode } from "./sound.js";
import {
  applyDifficulty,
  DEFAULT_DIFFICULTY,
  isDifficultyUnlocked as checkDifficultyUnlocked,
} from "./difficulty.js";
import { createTimeline, introSteps, outroSteps } from "./staging.js";
import { prefersReducedMotion } from "../../components/motion.js";
import { averageDifficulty } from "./stats.js";
import { loadSettings, normalizeSettings, saveSettings } from "./settings.js";
import { matcherOptionsFor } from "./input-style.js";
import { weakWeights } from "./weak.js";
import { mergeWeights, roleWordWeights } from "./word-weights.js";
import { bestKey, clearKey, createStore, getBackend } from "./storage.js";
import {
  loadDifficulties,
  loadJobs,
  loadRoles,
  loadVocabulary,
  pickWords,
  shuffle,
} from "./vocabulary.js";
import { createView } from "./view.js";

// 1フレームで進める時間の上限(重い処理や一時停止からの復帰で距離が一気に減らないようにする)
const MAX_FRAME_SECONDS = 0.1;
const DEFAULT_ROLE_ID = "senpai";
// 復習リストで始めた用語確認の「職種」の表示(職種ではないので、名前だけ)
const REVIEW_JOB = { id: "review", name: "復習リスト" };

const view = createView(document.querySelector("[data-game]"));
const backend = getBackend();
const store = createStore(backend);
// ゲームの設定(いまは、プレイ中の説明の表示だけ)。記録とは、別のキーに保存する
let settings = loadSettings(backend);
// アカウントの案内(初回だけ)を閉じたかどうか。記録(バージョン付き)とは別の、単純な印
const ACCOUNT_BANNER_KEY = "nolito:escape-boss:account-banner-dismissed:v1";

let jobs = [];
let roles = [];
let difficulties = [];
let config = { default_title: { id: "newbie", name: "新入社員" }, achievements: [] };
let rankingRoleId = DEFAULT_ROLE_ID;
let rankingDifficultyId = DEFAULT_DIFFICULTY;
// オンラインランキング(Phase 19 PR 3。任意)の、いま見ている役職・難易度(端末内ランキングとは別に選べる)
let onlineRankingRoleId = DEFAULT_ROLE_ID;
let onlineRankingDifficultyId = DEFAULT_DIFFICULTY;
let storageNotice = "";
let session = null;
// 開始・終わりの演出の進行(進んでいる間だけ、ある)
let timeline = null;

// 音(効果音・BGM)。設定は settings(既定は、なし)。音の準備は、設定が「なし」の間は、作らない
const sound = createSound();
// 「音」ボタンで「なし」にしたとき、次に押したら戻す先
let soundRestore = "all";
const applySound = () => {
  sound.configure({
    mode: settings.soundMode,
    volume: settings.volume,
    simple: settings.simpleSound,
  });
  view.setSoundSettings(settings);
};

const reducedMotion = () => prefersReducedMotion();
const stopTimeline = () => {
  timeline?.cancel();
  timeline = null;
};

const jobsById = () => Object.fromEntries(jobs.map((job) => [job.id, job.name]));

// 難易度に、いま挑戦できるか(role_clear_normal は、その役職を「ふつう」で 1 回以上クリアしていること)
const isDifficultyUnlockedFor = (difficulty, roleId) =>
  checkDifficultyUnlocked(difficulty, {
    difficultyClears: store.load().data.progress.difficultyClears,
    roleId,
    clearKey,
  });

// 自己ベスト(職種 × 役職 × 難易度)。ないときは null
const bestOfJob = (jobId, roleId, difficultyId) =>
  store.load().data.progress.bests[bestKey(jobId, roleId, difficultyId)] ?? null;

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
    difficulties,
    isDifficultyUnlocked: isDifficultyUnlockedFor,
    bestOf: bestOfJob,
    profile: {
      nickname: data.profile.nickname,
      titleId: titles.some((title) => title.id === data.profile.titleId)
        ? data.profile.titleId
        : config.default_title.id,
    },
    titles,
    rankingRoleId,
    rankingDifficultyId,
    ranking: getRanking(data, rankingRoleId, rankingDifficultyId),
    jobsById: jobsById(),
    achievements: config.achievements,
    unlocked: data.achievements,
    storageNotice,
    level: levelOf(data.progress.exp),
    masteries: jobMasteries(
      data.progress.jobs,
      jobs.map((job) => job.id),
    ),
  });
}

// オンラインランキング(Phase 19 PR 3。任意)の、いま選んでいる役職・難易度の上位を取ってきて描く。
// だれでも見られる(ログイン不要)。取得に失敗しても、ダッシュボードの表示は続ける
async function loadOnlineRanking() {
  view.renderOnlineRanking({ state: "loading" });
  const result = await fetchOnlineRanking(onlineRankingRoleId, onlineRankingDifficultyId);
  if (!result.ok) {
    view.renderOnlineRanking({ state: "error" });
    return;
  }
  view.renderOnlineRanking({ state: "ok", entries: result.data.entries, jobsById: jobsById() });
}

// クリアの記録を、オンラインランキングに送る(参加している人だけ)。押した操作ではないので、
// 失敗しても、静かに諦める(結果の画面は、この端末の記録だけで、問題なく成立するため)
function submitOnlineRanking({ cleared, difficulty, role, job, score, data }) {
  if (!cleared || !difficulty.rankable) return;
  if (!accountInfo.enabled || !accountInfo.user?.rankingOptIn) return;
  saveOnlineRanking({
    roleId: role.id,
    difficultyId: difficulty.id,
    jobId: job.id,
    nickname: data.profile.nickname,
    title: titleNameOf(config, data.profile.titleId),
    score,
  })
    .then((result) => {
      // 選んで見ている役職・難易度と同じなら、表を更新する(自分の記録が、すぐ反映されるように)
      if (
        result.ok &&
        role.id === onlineRankingRoleId &&
        difficulty.id === onlineRankingDifficultyId
      ) {
        loadOnlineRanking();
      }
    })
    .catch(() => {});
}

function bannerDismissed() {
  if (!backend) return false;
  try {
    return backend.getItem(ACCOUNT_BANNER_KEY) === "1";
  } catch {
    return false;
  }
}

function dismissAccountBanner() {
  view.hideAccountBanner();
  if (!backend) return;
  try {
    backend.setItem(ACCOUNT_BANNER_KEY, "1");
  } catch {
    // 保存できなくても、この場では閉じたままにする(次に開いたときは、また出ることがある)
  }
}

// ログインの状態(オンラインランキングに送ってよいかの判断にも使う)。取得できるまでは、送らない
let accountInfo = { enabled: false, user: null };

// アカウントの状態を取っておく。ログインしておらず、アカウント機能が使える環境でだけ、
// 初回の案内(閉じたら、もう出さない)も出す
async function initAccount() {
  accountInfo = await fetchMe();
  if (accountInfo.enabled && !accountInfo.user && !bannerDismissed()) view.showAccountBanner();
}

async function init() {
  try {
    [jobs, roles, config, difficulties] = await Promise.all([
      loadJobs(),
      loadRoles(),
      loadJson("/data/achievements.json"),
      loadDifficulties(),
    ]);
  } catch {
    view.showError("データを読み込めませんでした。ページを再読み込みしてください。");
    return;
  }
  const { status } = store.load();
  storageNotice = noticeFor(status);
  view.setExplanationSetting(settings.showExplanation);
  view.setGraphicsSetting(settings.simpleGraphics);
  view.setLineLevelSetting(settings.lineLevel);
  view.setSkipStagingSetting(settings.skipStaging);
  view.setWeakBoostSetting(settings.weakBoost);
  view.setInputStyleSetting(settings.inputStyle);
  applySound();
  view.bind({
    onStart: ({ mode, jobId, roleId, difficulty }) => {
      sound.unlock(); // ブラウザは、操作のあとにしか、音を許さない。開始のクリックの中で、準備する
      return mode === "check" ? startCheck({ jobId }) : startGame({ jobId, roleId, difficulty });
    },
    onSoundModeChange: (mode) => changeSound({ soundMode: mode }),
    onSoundVolumeInput: (value) => {
      // 動かしている間は、音量と表示だけ(保存は、離したとき)
      settings = normalizeSettings({ ...settings, volume: value });
      applySound();
    },
    onSoundVolumeChange: (value) => changeSound({ volume: value }),
    onSimpleSoundChange: (checked) => changeSound({ simpleSound: checked }),
    onSoundTest: () => {
      sound.unlock();
      if (!sound.play("correct")) {
        view.announce(
          settings.soundMode === "off"
            ? "音の設定が「なし」です。「効果音だけ」などを選んでください。"
            : "音を出せませんでした。音量と、ブラウザの音の設定を確認してください。",
        );
      }
    },
    onSoundToggle: () => {
      if (settings.soundMode !== "off") soundRestore = settings.soundMode;
      changeSound({ soundMode: toggledMode(settings.soundMode, soundRestore) });
    },
    onExplanationChange: (checked) => {
      settings = { ...settings, showExplanation: checked };
      saveSettings(backend, settings);
    },
    onGraphicsChange: (checked) => {
      settings = { ...settings, simpleGraphics: checked };
      saveSettings(backend, settings);
    },
    onLineLevelChange: (level) => {
      settings = normalizeSettings({ ...settings, lineLevel: level });
      saveSettings(backend, settings);
      view.setLineLevelSetting(settings.lineLevel);
    },
    onSkipStagingChange: (checked) => {
      settings = { ...settings, skipStaging: checked };
      saveSettings(backend, settings);
    },
    onWeakBoostChange: (level) => {
      settings = normalizeSettings({ ...settings, weakBoost: level });
      saveSettings(backend, settings);
      view.setWeakBoostSetting(settings.weakBoost);
    },
    onInputStyleChange: (name) => {
      settings = normalizeSettings({ ...settings, inputStyle: name });
      saveSettings(backend, settings);
      view.setInputStyleSetting(settings.inputStyle);
    },
    onCheckRetry: () => {
      if (session?.kind !== "check") return;
      if (session.review) startReview();
      else startCheck({ jobId: session.job.id });
    },
    onProfileChange: handleProfileChange,
    onRankingRoleChange: (roleId) => {
      rankingRoleId = roleId;
      view.renderRanking({
        entries: getRanking(store.load().data, roleId, rankingDifficultyId),
        jobsById: jobsById(),
      });
    },
    onRankingDifficultyChange: (difficultyId) => {
      rankingDifficultyId = difficultyId;
      view.renderRanking({
        entries: getRanking(store.load().data, rankingRoleId, difficultyId),
        jobsById: jobsById(),
      });
    },
    onBackupExport: exportBackup,
    onBackupImport: importBackup,
    onRetry: () =>
      session &&
      startGame({ jobId: session.job.id, roleId: session.role.id, difficulty: session.difficulty }),
    onBack: quit,
    onQuit: quit,
    onAccountBannerDismiss: dismissAccountBanner,
    onOnlineRankingRoleChange: (roleId) => {
      onlineRankingRoleId = roleId;
      loadOnlineRanking();
    },
    onOnlineRankingDifficultyChange: (difficultyId) => {
      onlineRankingDifficultyId = difficultyId;
      loadOnlineRanking();
    },
  });
  // 開始・終わりの演出は、飛ばせる(Enter・スペース・Esc・場面のクリック)
  view.bindSkip(() => timeline?.skip());
  refreshDashboard();
  initAccount(); // 失敗しても、ダッシュボードの表示は続ける(案内が出ない・オンラインランキングに送らないだけ)
  loadOnlineRanking();

  // 成績ページの「復習リストで用語確認をする」から来たとき(?review=1)。アドレスからは消す
  const params = new URLSearchParams(location.search);
  if (params.get("review") === "1") {
    history.replaceState(null, "", location.pathname);
    startReview();
  }
}

// 音の設定を変えて、保存し、すぐ反映する(BGM は、遊んでいる間なら、その場で始まる・止まる)
function changeSound(change) {
  settings = normalizeSettings({ ...settings, ...change });
  saveSettings(backend, settings);
  applySound();
  sound.unlock(); // 設定を変える操作の中で、準備する(設定を反映したあとに。「なし」の間は、作らない)
}

// 記録の書き出し・読み込み(Phase 19 PR 1。バックアップ・機種変更用。キーみちと同じ考え方)
function download(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const dateStamp = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
};

const BACKUP_IMPORT_ERRORS = {
  "invalid-json": "JSONとして読み取れません。この画面で書き出したファイルを選んでください。",
  "invalid-format": "この画面で書き出したファイルではありません。",
  "newer-version":
    "新しい版の書き出しファイルです。ページを再読み込みして、もう一度お試しください。",
  "invalid-data": "ファイルの中身が正しくありません(壊れているか、書き換えられています)。",
  "too-large": "ファイルが大きすぎます(1MBまでです)。",
};

function exportBackup() {
  const json = store.exportJson();
  if (json === null) {
    return {
      ok: false,
      message: "書き出せる記録がありません(保存されているデータが読めない状態です)。",
    };
  }
  download(`escape-boss-${dateStamp()}.json`, json, "application/json;charset=utf-8");
  return { ok: true, message: "JSONファイルに書き出しました。" };
}

function importBackup(text) {
  const result = store.importJson(text);
  if (!result.ok) {
    return { ok: false, message: BACKUP_IMPORT_ERRORS[result.error] ?? "読み込めませんでした。" };
  }
  storageNotice = noticeFor(store.status, result.saved);
  refreshDashboard();
  return {
    ok: true,
    message: result.saved
      ? "記録を置き換えました。"
      : "記録を置き換えました(ただし、この環境では保存できません)。",
  };
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
  await guardedStart(() => beginGame(options));
}

async function startCheck(options) {
  await guardedStart(() => beginCheck(options));
}

async function guardedStart(begin) {
  if (starting || session?.state.status === "playing") return;
  starting = true;
  try {
    await begin();
  } finally {
    starting = false;
  }
}

// 用語確認を始める。追ってくる人も時間制限もない。結果は、保存しない。
async function beginCheck({ jobId }) {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return;
  let vocabulary;
  try {
    vocabulary = await loadVocabulary(jobId);
  } catch {
    view.showError("語録を読み込めませんでした。時間をおいてもう一度お試しください。");
    return;
  }
  view.showError("");
  startCheckSession({ job, words: pickCheckWords(vocabulary.items) });
}

// 復習リスト(直近のプレイでミスした語)で、用語確認を始める。結果は、保存しない。
async function startReview() {
  await guardedStart(beginReview);
}

async function beginReview() {
  let vocabularies;
  try {
    vocabularies = await Promise.all(jobs.map((job) => loadVocabulary(job.id)));
  } catch {
    view.showError("語録を読み込めませんでした。時間をおいてもう一度お試しください。");
    return;
  }
  const list = buildReviewList(store.load().data.results, indexWords(vocabularies));
  if (list.length === 0) {
    view.showError(
      "復習する語は、まだありません。連続タイピングでミスすると、成績ページの復習リストに出ます。",
    );
    return;
  }
  view.showError("");
  // 語の順は、ミスの多い順のままだと、順番を覚えてしまうので、混ぜる
  startCheckSession({
    job: REVIEW_JOB,
    words: shuffle(list.map((entry) => entry.word)),
    review: true,
  });
}

// 設定の「ローマ字の書き方」で、語のマッチャーを作る(ゲームを始めたときの設定。途中では、変わらない)
const newMatcher = (reading) => createMatcher(reading, matcherOptionsFor(settings.inputStyle));

// 用語確認の進行を始める(職種の 10 語でも、復習リストでも共通)
function startCheckSession({ job, words, review = false }) {
  stopTimeline();
  sound.stopBgm();
  if (session) cancelAnimationFrame(session.frameId);
  session = {
    kind: "check",
    review,
    job,
    words,
    matcher: newMatcher(words[0].reading),
    state: createCheckState(words.length),
    startedAt: performance.now(),
  };
  view.showPlay({ mode: "check", jobName: job.name, goal: words.length });
  view.renderWord(words[0], session.matcher);
  view.renderCheckProgress(session.state);
  announceWord(`用語確認を始めます。${review ? "" : "職種は"}${job.name}。${words.length}語です。`);
}

// 用語確認では、語が変わるたびに、語・読み・説明を読み上げる
function announceWord(prefix = "") {
  const word = session.words[session.state.index];
  view.announce(
    `${prefix}${session.state.index + 1}語目。${word.japanese}。読みは${word.reading}。${word.explanation}`,
  );
}

function handleCheckChar(char) {
  const { state } = session;
  if (state.status !== "playing") return;
  const word = session.words[state.index];
  const result = session.matcher.input(char);
  if (result === "miss") {
    session.state = checkMiss(state, word.id); // 罰はない。数えるだけ
    view.flashMiss();
    sound.play("miss");
    view.renderCheckProgress(session.state);
    return;
  }
  session.state = checkHit(state);
  if (result === "ok") {
    view.renderWord(word, session.matcher);
    return;
  }
  // 1語打ち終わった
  session.state = checkNext(session.state);
  sound.play(session.state.status === "done" ? "clear" : "correct");
  if (session.state.status === "done") {
    finishCheck();
    return;
  }
  session.matcher = newMatcher(session.words[session.state.index].reading);
  view.renderWord(session.words[session.state.index], session.matcher);
  view.renderCheckProgress(session.state);
  announceWord();
}

// 用語確認の結果を出す(保存しない)
function finishCheck() {
  const { state, words, job } = session;
  const summary = summarizeCheck(state, words);
  view.showCheckResult({
    jobName: job.name,
    summary,
    words,
    elapsed: (performance.now() - session.startedAt) / 1000,
  });
  view.announce(
    summary.miss === 0
      ? `用語確認が終わりました。${summary.total}語をミスなく確認できました。`
      : `用語確認が終わりました。ミスは${summary.miss}回でした。`,
  );
}

async function beginGame({ jobId, roleId, difficulty: difficultyId }) {
  const job = jobs.find((j) => j.id === jobId);
  const role = roles.find((r) => r.id === roleId);
  const difficulty =
    difficulties.find((d) => d.id === difficultyId) ??
    difficulties.find((d) => d.id === DEFAULT_DIFFICULTY);
  if (!job || !role || !difficulty) return;
  if (!isRoleUnlocked(store.load().data, role)) {
    view.showError("この役職には、まだ挑戦できません。");
    return;
  }
  if (!isDifficultyUnlockedFor(difficulty, role.id)) {
    view.showError("この難易度には、まだ挑戦できません。");
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

  // 難易度の倍率をかけた stage(正解で増える距離・時間で縮む速さ・初期距離だけが変わる)
  const stage = applyDifficulty(role.stage, difficulty);
  // 苦手な語(直近のプレイでミスした語)は、設定に応じて、出やすくする。役職ごとの、語の長さの出やすさ
  // (stage.word_weights)も、かけ合わせる。同じゲームの中で、同じ語は出ない
  const weights = mergeWeights(
    weakWeights(store.load().data.results, vocabulary.items, { level: settings.weakBoost }),
    roleWordWeights(vocabulary.items, stage),
  );
  const words = pickWords(vocabulary.items, role.id, stage.goal_words, Math.random, { weights });
  // 前のゲームの処理が残っていれば、必ず止めてから、新しいゲームに置き換える
  stopTimeline();
  sound.stopBgm();
  // 役職ごとの音の個性(Phase 23 PR 1)。BGM・効果音の速さ・高さを、この役職のものにする(危ない状況の倍率は、リセットされる)
  sound.setRoleSound(roleSoundOf(role));
  if (session) cancelAnimationFrame(session.frameId);
  session = {
    kind: "chase",
    // intro(開始の演出。時間も入力も止まっている)→ play → outro(終わりの演出。結果は保存済み)
    phase: "intro",
    lines: createLines({ gapMs: lineLevelOf(settings.lineLevel).gapMs }),
    wasDanger: false,
    job,
    role,
    difficulty: difficulty.id,
    stage,
    vocabularyVersion: vocabulary.version,
    words,
    index: 0,
    matcher: newMatcher(words[0].reading),
    state: createGameState(stage),
    keyStats: createKeyStats(),
    // いまの語の、最初の正しい打鍵の時刻(ゲーム内の経過秒)。距離の「速さの分」に使う
    wordStartedAt: null,
    lastFrame: performance.now(),
    frameId: 0,
  };
  view.showPlay({
    mode: "chase",
    job,
    jobName: job.name,
    role,
    goal: stage.goal_words,
    showExplanation: settings.showExplanation,
    simpleGraphics: settings.simpleGraphics,
  });
  view.announce(`ゲーム開始。職種は${job.name}。${role.name}が追ってきます。よーい…`);
  view.renderWord(words[0], session.matcher);
  view.renderStats(session.state, stage);
  beginIntro();
}

// 開始の演出。この間は、時間が進まず、入力も受け付けない(飛ばせる)。終わったら、ゲームを始める
function beginIntro() {
  const current = session;
  timeline = createTimeline(introSteps(reducedMotion()), {
    onStep: (step) => view.showStaging("intro", step.text),
    onDone: () => {
      timeline = null;
      if (session === current) startPlaying();
    },
  });
  timeline.start();
  // 「演出を自動で飛ばす」設定(Phase 23 PR2)。既存の「飛ばす」操作(Enter・スペース・Esc・クリック)と、同じしくみ
  if (settings.skipStaging) timeline.skip();
}

// 追ってくる人のセリフ(飾りの吹き出し)。言わないとき(間隔・セリフなし)は、null
function say(event) {
  const line = session.lines.pick(session.role, event, performance.now());
  if (line) view.showBubble(session.role.name, line, lineLevelOf(settings.lineLevel).bubbleMs);
  return line;
}

// 時間の進みは、ここから始まる(開始の演出の時間は、ゲームの経過時間に入らない)
function startPlaying() {
  view.clearStaging();
  session.phase = "play";
  session.lastFrame = performance.now();
  view.announce("スタート!");
  say("start");
  sound.play("start");
  sound.startBgm({ delaySec: 0.6 }); // 設定が「効果音 + BGM」のときだけ、鳴る
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
  if (state.status !== "playing") {
    finish();
    return;
  }
  // 危ない状態に入った瞬間だけ、セリフ(出たり入ったりしても、間隔は空く)
  const danger = isDanger(state.distance, session.stage.max_distance);
  if (danger && !session.wasDanger) {
    say("near");
    sound.play("near");
  }
  // 危ない状況の間、BGM を少し速くする(Phase 23 PR 1)。状態が変わったときだけ伝える
  if (danger !== session.wasDanger) sound.setDanger(danger);
  session.wasDanger = danger;
}

// 結果を記録し、ランキング・実績を更新して、結果画面を出す
function finish() {
  cancelAnimationFrame(session.frameId);
  sound.stopBgm();
  session.phase = "outro";
  const { state, stage, job, role } = session;
  const difficulty =
    difficulties.find((d) => d.id === session.difficulty) ??
    difficulties.find((d) => d.id === DEFAULT_DIFFICULTY);
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
    difficulty: session.difficulty,
    // ミス分析・苦手文字の元データ(キーごとの集計・打ち間違いの組・語ごとのミス数)
    keys: session.keyStats.keys,
    confusions: session.keyStats.confusions,
    wordMisses: session.keyStats.wordMisses,
    // 成績の元データ(最大の連続ノーミス・難易度ごとの打ち終えた語数)
    streak: state.bestStreak,
    wordsByDifficulty: state.byDifficulty,
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
    const { progress, gained, levelUp } = grantExp(recorded.progress, result, {
      newAchievements: ids.length,
      multiplier: difficulty.exp_multiplier,
    });
    return {
      data: unlockAchievements({ ...recorded, progress }, ids, result.playedAt),
      rank,
      ids,
      gained,
      levelUp,
    };
  });

  submitOnlineRanking({
    cleared: state.status === "cleared",
    difficulty,
    role,
    job,
    score,
    data: out.data,
  });

  const newAchievements = out.ids.map((id) => config.achievements.find((a) => a.id === id));
  const { gained: expGained, levelUp } = out;
  const kaicho = roles.find((r) => r.unlock);
  const kaichoUnlocked = Boolean(
    kaicho && !isRoleUnlocked(before, kaicho) && isRoleUnlocked(out.data, kaicho),
  );
  storageNotice = noticeFor(store.status, out.saved);
  rankingRoleId = role.id;
  rankingDifficultyId = difficulty.id;

  const resultView = {
    state,
    stage,
    jobName: job.name,
    roleName: role.name,
    score,
    accuracy,
    cps,
    averageDifficulty: averageDifficulty(state.byDifficulty),
    rank: out.rank,
    rankable: difficulty.rankable,
    newAchievements,
    kaichoUnlocked,
    expGained,
    levelUp,
    notice: storageNotice,
    analysis: {
      misses: state.miss,
      keys: mostMissedKeys(session.keyStats, 3),
      confusions: topConfusions(session.keyStats, 3),
    },
    missed: missedWords(session.words, session.keyStats.wordMisses),
  };
  const cleared = state.status === "cleared";
  const extras = [
    cleared ? "ステージクリア。逃げ切りました。" : "ゲームオーバー。",
    `スコアは${score}点。`,
    cleared && out.rank ? `ランキング${out.rank}位。` : "",
    newAchievements.length > 0
      ? `新しい実績: ${newAchievements.map((a) => a.name).join("、")}。`
      : "",
    kaichoUnlocked ? "会長に挑戦できるようになりました。" : "",
    levelUp ? `レベル${levelUp.to}になりました。` : "",
  ];
  // 記録は保存済み。終わりの演出(飛ばせる)のあと、結果の画面を出して、結果を読み上げる
  beginOutro(resultView, extras.filter(Boolean).join(""));
}

// 終わりの演出(クリア・ゲームオーバー共通の型)。追ってくる人の最後のセリフは、結果の画面にも残す
function beginOutro(resultView, message) {
  const current = session;
  const steps = outroSteps(session.state.status, reducedMotion());
  const kind = session.state.status === "cleared" ? "clear" : "over";
  const line = session.lines.pick(session.role, kind, performance.now());
  // 役職ごとの、終わりの演出の見せ方(roles.json の scene.outro。なければ、全役職共通)
  const outroStyle = outroStyleOf(session.role, kind);
  if (line) view.showBubble(session.role.name, line, steps[0].ms);
  sound.play(kind);
  timeline = createTimeline(steps, {
    onStep: (step) => view.showStaging(step.id, step.text, outroStyle),
    onDone: () => {
      timeline = null;
      if (session !== current) return;
      view.showResult({ ...resultView, quote: line ?? "" });
      view.announce(message);
    },
  });
  timeline.start();
  // 「演出を自動で飛ばす」設定(Phase 23 PR2)。既存の「飛ばす」操作と、同じしくみ(飛ばしても onDone は1回だけ)
  if (settings.skipStaging) timeline.skip();
}

function handleChar(char) {
  if (session?.kind === "check") {
    handleCheckChar(char);
    return;
  }
  // 開始・終わりの演出の間は、入力を受け付けない(間違いにも数えない)
  if (!session || session.state.status !== "playing" || session.phase !== "play") return;
  // 打鍵の集計は、結果を確定する(finish が呼ばれる)前に済ませる。最後の1打も記録に入れるため。
  const key = char.toLowerCase();
  const expected = session.matcher.remaining.charAt(0);
  const word = session.words[session.index];
  const result = session.matcher.input(char);
  if (result === "miss") {
    session.keyStats = recordMiss(session.keyStats, expected, key, word.id);
    view.flashMiss();
    view.pulseScene("miss");
    sound.play("miss");
    update(applyMiss(session.state, session.stage));
    if (session.state.status === "playing") say("miss");
    return;
  }
  session.keyStats = recordHit(session.keyStats, key);
  session.state = applyHit(session.state);
  session.wordStartedAt ??= session.state.elapsed;
  if (result === "ok") {
    view.renderWord(session.words[session.index], session.matcher);
    return;
  }
  // 1語打ち終わった
  // 文字数の分は、書き方の設定に関係なく、標準の書き方の長さで数える(設定で距離が変わらないように)
  const charCount = createMatcher(word.reading).canonicalLength;
  const seconds = session.state.elapsed - session.wordStartedAt;
  update(
    applyCorrect(session.state, session.stage, charCount, {
      difficulty: word.difficulty,
      seconds,
      keystrokes: session.matcher.typed.length,
    }),
  );
  view.pulseScene("gain");
  if (session.state.status !== "playing") return;
  sound.play("correct");
  session.index += 1;
  session.wordStartedAt = null;
  session.matcher = newMatcher(session.words[session.index].reading);
  view.renderWord(session.words[session.index], session.matcher);
}

function quit() {
  stopTimeline();
  sound.stopBgm();
  sound.setRoleSound(); // ダッシュボードに戻ったら、役職の音の個性を、既定(1・1)に戻す
  if (session) cancelAnimationFrame(session.frameId);
  session = null;
  refreshDashboard();
  view.showDashboard();
}

// タブが見えない間は、音も止める(BGM を止め、戻ったら続ける)
document.addEventListener("visibilitychange", () => sound.setHidden(document.hidden));

// タブが見えない間は進めない(戻ったときに距離が減り切っているのを防ぐ)
document.addEventListener("visibilitychange", () => {
  if (!session || session.kind !== "chase" || session.state.status !== "playing") return;
  if (session.phase !== "play") return; // 演出の間は、ゲームの時間を動かさない
  if (document.hidden) {
    cancelAnimationFrame(session.frameId);
  } else {
    session.lastFrame = performance.now();
    session.frameId = requestAnimationFrame(frame);
  }
});

attachInput(view.input, { onChar: handleChar, onImeChange: view.showImeWarning });

init();
