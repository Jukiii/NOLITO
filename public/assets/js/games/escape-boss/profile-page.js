import { el } from "../../components/dom.js";
import { fetchOnlineRanking } from "../../account/client.js";
import { availableTitles } from "./achievements.js";
import { achievementItem } from "./achievement-item.js";
import { DEFAULT_DIFFICULTY } from "./difficulty.js";
import { levelOf } from "./levels.js";
import { getRanking, updateProfile } from "./records.js";
import { loadSettings } from "./settings.js";
import { MAX_IMPORT_BYTES, createStore, getBackend } from "./storage.js";
import { nextTabIndex, resolveTab } from "./tabs.js";
import { loadDifficulties, loadJobs, loadRoles } from "./vocabulary.js";

// プレイヤー・記録のページ(/games/escape-boss/profile/)。ニックネーム・称号・ランキング・実績・記録の書き出し/読み込みを、
// タブで切り替える。HTML は静的に書き、ここでは data 属性を目印に中身だけを更新する。文字列は textContent(el())だけで入れる。

const root = document.querySelector("[data-profile-page]");
const $ = (selector) => root.querySelector(selector);
const $$ = (selector) => [...root.querySelectorAll(selector)];

const formatDate = (ms) => new Date(ms).toLocaleDateString("ja-JP");
const formatNumber = (n) => Math.round(n).toLocaleString("ja-JP");

const STORAGE_NOTICES = {
  unavailable:
    "この端末(ブラウザ)では記録を保存できません。記録の変更は、ページを閉じると消えます。",
  corrupt:
    "保存されていたデータが壊れていたため、記録を初期化しました。(元のデータは、ブラウザ内の別の場所に退避してあります)",
  failed: "記録を保存できませんでした。ブラウザの保存容量や設定を確認してください。",
};

const ONLINE_RANKING_STATUS = {
  loading: "読み込んでいます…",
  empty: "まだ、参加している人がいません。",
  error: "読み込めませんでした。しばらくして、もう一度お試しください。",
};

const BACKUP_IMPORT_ERRORS = {
  "invalid-json": "JSONとして読み取れません。この画面で書き出したファイルを選んでください。",
  "invalid-format": "この画面で書き出したファイルではありません。",
  "newer-version":
    "新しい版の書き出しファイルです。ページを再読み込みして、もう一度お試しください。",
  "invalid-data": "ファイルの中身が正しくありません(壊れているか、書き換えられています)。",
  "too-large": "ファイルが大きすぎます(1MBまでです)。",
};

const backend = getBackend();
const store = createStore(backend);
const settings = loadSettings(backend);

let jobs = [];
let roles = [];
let difficulties = [];
let config = { default_title: { id: "newbie", name: "新入社員" }, achievements: [] };
let storageNotice = "";
let rankingRoleId = "";
let rankingDifficultyId = DEFAULT_DIFFICULTY;
let onlineRankingRoleId = "";
let onlineRankingDifficultyId = DEFAULT_DIFFICULTY;
let onlineLoaded = false;

const jobsById = () => Object.fromEntries(jobs.map((job) => [job.id, job.name]));

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} (${response.status})`);
  return response.json();
}

function noticeFor(status, saved = true) {
  if (status === "unavailable") return "unavailable";
  if (status === "corrupt") return "corrupt";
  return saved ? "" : "failed";
}

function showStorageNotice() {
  const notice = $("[data-storage-notice]");
  notice.textContent = STORAGE_NOTICES[storageNotice] ?? "";
  notice.hidden = !STORAGE_NOTICES[storageNotice];
}

function showError(message) {
  const error = $("[data-error]");
  error.textContent = message;
  error.hidden = !message;
}

function showStatus(selector, message) {
  const node = $(selector);
  node.textContent = message;
  node.hidden = !message;
}

// ---- タブ ----

const tabs = $$("[data-tab]");
const panels = $$("[data-panel]");
const tabIds = tabs.map((tab) => tab.dataset.tab);

function selectTab(id, { focus = false, updateUrl = true } = {}) {
  for (const tab of tabs) {
    const selected = tab.dataset.tab === id;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  }
  for (const panel of panels) panel.hidden = panel.dataset.panel !== id;
  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set("tab", id);
    history.replaceState(null, "", url);
  }
  if (id === "ranking" && !onlineLoaded) {
    onlineLoaded = true;
    loadOnlineRanking();
  }
}

function bindTabs() {
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      const next = nextTabIndex(event.key, index, tabs.length);
      if (next === null) return;
      event.preventDefault();
      selectTab(tabIds[next], { focus: true });
    });
  });
}

// ---- プレイヤー ----

function renderPlayer() {
  const { data } = store.load();
  const level = levelOf(data.progress.exp);
  $("[data-level]").textContent = String(level.level);
  const max = level.nextAt === null;
  $("[data-level-max]").hidden = !max;
  $("[data-level-bar]").setAttribute("aria-valuenow", String(Math.round(level.ratio * 100)));
  $("[data-level-fill]").style.width = `${(level.ratio * 100).toFixed(1)}%`;
  $("[data-level-text]").textContent = max
    ? `累計の経験値 ${level.exp}`
    : `経験値 ${level.into} / ${level.needed}(次のレベルまで、あと${level.remaining})`;

  const titles = availableTitles(config, data.achievements);
  const titleId = titles.some((title) => title.id === data.profile.titleId)
    ? data.profile.titleId
    : config.default_title.id;
  $("[data-nickname]").value = data.profile.nickname;
  $("[data-title-select]").replaceChildren(
    ...titles.map((title) =>
      el("option", { value: title.id, selected: title.id === titleId }, title.name),
    ),
  );
}

function saveProfile() {
  const nickname = $("[data-nickname]").value;
  const titleId = $("[data-title-select]").value;
  const out = store.update((data) => {
    const ids = availableTitles(config, data.achievements).map((title) => title.id);
    return { data: updateProfile(data, { nickname, titleId }, ids) };
  });
  $("[data-nickname]").value = out.data.profile.nickname;
  storageNotice = noticeFor(store.status, out.saved);
  showStorageNotice();
  showStatus(
    "[data-profile-status]",
    out.saved ? "保存しました。" : "この端末では保存できません。",
  );
}

// ---- ランキング ----

function rankingRows(entries, meta) {
  return entries.map((entry, index) =>
    el(
      "tr",
      {},
      el("th", { scope: "row", class: "ranking__rank" }, `${index + 1}位`),
      el(
        "td",
        {},
        el("span", { class: "ranking__name" }, entry.nickname),
        entry.title ? el("span", { class: "ranking__title" }, entry.title) : "",
      ),
      el(
        "td",
        { class: "ranking__score" },
        el("span", { class: "ranking__points" }, formatNumber(entry.score)),
        el("span", { class: "ranking__meta" }, meta(entry)),
      ),
    ),
  );
}

const roleOptions = (selectedId) =>
  roles.map((role) =>
    el("option", { value: role.id, selected: role.id === selectedId }, role.name),
  );

const difficultyOptions = (selectedId) =>
  difficulties
    .filter((difficulty) => difficulty.rankable)
    .map((difficulty) =>
      el(
        "option",
        { value: difficulty.id, selected: difficulty.id === selectedId },
        difficulty.name,
      ),
    );

function renderRanking() {
  const entries = getRanking(store.load().data, rankingRoleId, rankingDifficultyId);
  const names = jobsById();
  $("[data-ranking-empty]").hidden = entries.length > 0;
  $("[data-ranking-table]").hidden = entries.length === 0;
  $("[data-ranking-body]").replaceChildren(
    ...rankingRows(
      entries,
      (entry) => `${names[entry.jobId] ?? entry.jobId} ・ ${formatDate(entry.playedAt)}`,
    ),
  );
}

function renderOnlineRanking({ state, entries = [] }) {
  const table = $("[data-online-ranking-table]");
  const status = $("[data-online-ranking-status]");
  if (state === "ok" && entries.length > 0) {
    status.textContent = "";
    table.hidden = false;
  } else {
    status.textContent =
      state === "ok" ? ONLINE_RANKING_STATUS.empty : ONLINE_RANKING_STATUS[state];
    table.hidden = true;
  }
  const names = jobsById();
  $("[data-online-ranking-body]").replaceChildren(
    ...rankingRows(entries, (entry) => names[entry.jobId] ?? entry.jobId),
  );
}

// だれでも見られる(ログイン不要)。取得に失敗しても、ほかのタブの表示は続ける
async function loadOnlineRanking() {
  renderOnlineRanking({ state: "loading" });
  const result = await fetchOnlineRanking(onlineRankingRoleId, onlineRankingDifficultyId);
  if (!result.ok) {
    renderOnlineRanking({ state: "error" });
    return;
  }
  renderOnlineRanking({ state: "ok", entries: result.data.entries });
}

function setupRankingControls() {
  $("[data-ranking-role]").replaceChildren(...roleOptions(rankingRoleId));
  $("[data-ranking-difficulty]").replaceChildren(...difficultyOptions(rankingDifficultyId));
  $("[data-online-ranking-role]").replaceChildren(...roleOptions(onlineRankingRoleId));
  $("[data-online-ranking-difficulty]").replaceChildren(
    ...difficultyOptions(onlineRankingDifficultyId),
  );
  $("[data-ranking-role]").addEventListener("change", (event) => {
    rankingRoleId = event.target.value;
    renderRanking();
  });
  $("[data-ranking-difficulty]").addEventListener("change", (event) => {
    rankingDifficultyId = event.target.value;
    renderRanking();
  });
  $("[data-online-ranking-role]").addEventListener("change", (event) => {
    onlineRankingRoleId = event.target.value;
    loadOnlineRanking();
  });
  $("[data-online-ranking-difficulty]").addEventListener("change", (event) => {
    onlineRankingDifficultyId = event.target.value;
    loadOnlineRanking();
  });
}

// ---- 称号・実績 ----

function renderAchievements() {
  const { data } = store.load();
  const definitions = config.achievements;
  const done = definitions.filter((definition) => definition.id in data.achievements).length;
  $("[data-achievement-summary]").textContent = `解放済み ${done} / ${definitions.length}`;
  $("[data-achievement-list]").replaceChildren(
    ...definitions.map((definition) =>
      achievementItem(definition, data.achievements[definition.id]),
    ),
  );
}

// ---- 記録の書き出し・読み込み ----

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
  showStorageNotice();
  renderAll();
  return {
    ok: true,
    message: result.saved
      ? "記録を置き換えました。"
      : "記録を置き換えました(ただし、この環境では保存できません)。",
  };
}

function bindBackup() {
  const showBackupStatus = (message) => showStatus("[data-backup-status]", message);
  $("[data-backup-export]").addEventListener("click", () => {
    showBackupStatus(exportBackup().message);
  });
  const dialog = $("#backup-import-dialog");
  const dialogMessage = $("[data-backup-import-message]");
  let pendingImportText = null;
  $("[data-backup-import]").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      showBackupStatus("ファイルが大きすぎます(1MBまでです)。");
      return;
    }
    pendingImportText = await file.text();
    dialogMessage.textContent = "";
    dialogMessage.hidden = true;
    dialog.showModal();
  });
  $("[data-backup-import-confirm]").addEventListener("click", () => {
    if (pendingImportText === null) return;
    const result = importBackup(pendingImportText);
    pendingImportText = null;
    if (result.ok) {
      dialog.close();
      showBackupStatus(result.message);
      return;
    }
    dialogMessage.textContent = result.message;
    dialogMessage.hidden = false;
  });
}

// ---- 全体 ----

function renderAll() {
  renderPlayer();
  renderRanking();
  renderAchievements();
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
    showError("データを読み込めませんでした。ページを再読み込みしてください。");
    return;
  }
  storageNotice = noticeFor(store.load().status);
  showStorageNotice();

  // ランキングの初期の役職は、前回ゲームで選んだ役職(なければ先頭)。難易度は「ふつう」
  const remembered = settings.lastChoice?.role;
  const initialRole = roles.some((role) => role.id === remembered) ? remembered : roles[0]?.id;
  rankingRoleId = initialRole ?? "";
  onlineRankingRoleId = rankingRoleId;

  setupRankingControls();
  renderAll();
  bindTabs();
  $("[data-profile]").addEventListener("submit", (event) => {
    event.preventDefault();
    saveProfile();
  });
  bindBackup();

  const requested = new URLSearchParams(location.search).get("tab");
  selectTab(resolveTab(requested, tabIds), { updateUrl: false });
}

init();
