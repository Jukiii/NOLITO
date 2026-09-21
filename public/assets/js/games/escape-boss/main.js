import { availableTitles, evaluateAchievements, titleName as titleNameOf } from "./achievements.js";
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
  isRoleUnlocked,
  recordResult,
  unlockAchievements,
  updateProfile,
} from "./records.js";
import { createLines, BUBBLE_MS } from "./lines.js";
import { createMatcher } from "./romaji.js";
import { buildReviewList, indexWords } from "./review.js";
import { isDanger } from "./scene.js";
import { summarize } from "./score.js";
import { toggledMode } from "./sound.js";
import { createTimeline, introSteps, outroSteps } from "./staging.js";
import { averageDifficulty } from "./stats.js";
import { loadSettings, normalizeSettings, saveSettings } from "./settings.js";
import { matcherOptionsFor } from "./input-style.js";
import { weakWeights } from "./weak.js";
import { mergeWeights, roleWordWeights } from "./word-weights.js";
import { createStore, getBackend } from "./storage.js";
import { loadJobs, loadRoles, loadVocabulary, pickWords, shuffle } from "./vocabulary.js";
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

let jobs = [];
let roles = [];
let config = { default_title: { id: "newbie", name: "新入社員" }, achievements: [] };
let rankingRoleId = DEFAULT_ROLE_ID;
let storageNotice = "";
let session = null;
// 開始・終わりの演出の進行(進んでいる間だけ、ある)
let timeline = null;

// 音(効果音・BGM)。設定は settings(既定は、なし)。音の準備は、設定が「なし」の間は、作らない
const sound = createSound();
// 「音」ボタンで「なし」にしたとき、次に押したら戻す先
let soundRestore = "all";
const applySound = () => {
  sound.configure({ mode: settings.soundMode, volume: settings.volume });
  view.setSoundSettings(settings);
};

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const stopTimeline = () => {
  timeline?.cancel();
  timeline = null;
};

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
  view.setExplanationSetting(settings.showExplanation);
  view.setWeakBoostSetting(settings.weakBoost);
  view.setInputStyleSetting(settings.inputStyle);
  applySound();
  view.bind({
    onStart: ({ mode, jobId, roleId }) => {
      sound.unlock(); // ブラウザは、操作のあとにしか、音を許さない。開始のクリックの中で、準備する
      return mode === "check" ? startCheck({ jobId }) : startGame({ jobId, roleId });
    },
    onSoundModeChange: (mode) => changeSound({ soundMode: mode }),
    onSoundVolumeInput: (value) => {
      // 動かしている間は、音量と表示だけ(保存は、離したとき)
      settings = normalizeSettings({ ...settings, volume: value });
      applySound();
    },
    onSoundVolumeChange: (value) => changeSound({ volume: value }),
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
      view.renderRanking({ entries: getRanking(store.load().data, roleId), jobsById: jobsById() });
    },
    onRetry: () => session && startGame({ jobId: session.job.id, roleId: session.role.id }),
    onBack: quit,
    onQuit: quit,
  });
  // 開始・終わりの演出は、飛ばせる(Enter・スペース・Esc・場面のクリック)
  view.bindSkip(() => timeline?.skip());
  refreshDashboard();

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
  if (session) cancelAnimationFrame(session.frameId);
  session = {
    kind: "chase",
    // intro(開始の演出。時間も入力も止まっている)→ play → outro(終わりの演出。結果は保存済み)
    phase: "intro",
    lines: createLines(),
    wasDanger: false,
    job,
    role,
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
}

// 追ってくる人のセリフ(飾りの吹き出し)。言わないとき(間隔・セリフなし)は、null
function say(event) {
  const line = session.lines.pick(session.role, event, performance.now());
  if (line) view.showBubble(session.role.name, line, BUBBLE_MS);
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
  session.wasDanger = danger;
}

// 結果を記録し、ランキング・実績を更新して、結果画面を出す
function finish() {
  cancelAnimationFrame(session.frameId);
  sound.stopBgm();
  session.phase = "outro";
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
    return { data: unlockAchievements(recorded, ids, result.playedAt), rank, ids };
  });

  const newAchievements = out.ids.map((id) => config.achievements.find((a) => a.id === id));
  const kaicho = roles.find((r) => r.unlock);
  const kaichoUnlocked = Boolean(
    kaicho && !isRoleUnlocked(before, kaicho) && isRoleUnlocked(out.data, kaicho),
  );
  storageNotice = noticeFor(store.status, out.saved);
  rankingRoleId = role.id;

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
    newAchievements,
    kaichoUnlocked,
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
  ];
  // 記録は保存済み。終わりの演出(飛ばせる)のあと、結果の画面を出して、結果を読み上げる
  beginOutro(resultView, extras.filter(Boolean).join(""));
}

// 終わりの演出(クリア・ゲームオーバー共通の型)。追ってくる人の最後のセリフは、結果の画面にも残す
function beginOutro(resultView, message) {
  const current = session;
  const steps = outroSteps(session.state.status, reducedMotion());
  const line = session.lines.pick(
    session.role,
    session.state.status === "cleared" ? "clear" : "over",
    performance.now(),
  );
  if (line) view.showBubble(session.role.name, line, steps[0].ms);
  sound.play(session.state.status === "cleared" ? "clear" : "over");
  timeline = createTimeline(steps, {
    onStep: (step) => view.showStaging(step.id, step.text),
    onDone: () => {
      timeline = null;
      if (session !== current) return;
      view.showResult({ ...resultView, quote: line ?? "" });
      view.announce(message);
    },
  });
  timeline.start();
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
