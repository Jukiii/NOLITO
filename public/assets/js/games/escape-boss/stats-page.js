// 成績ページ。保存された記録(端末内)を読み、累計・成長グラフ・苦手なキー・最近のプレイを表示する。
// 表示は「追ってくる人」と「対象の回数」の絞り込みに従って、ページ全体を同じ範囲で描き直す。
// 文字列(語録・ニックネーム由来の値を含む)は、すべて textContent で入れる。
import { el } from "../../components/dom.js";
import { renderLineChart } from "./chart.js";
import { mergeKeyStats, topConfusions, weakKeys } from "./keystats.js";
import {
  bestScoreHistory,
  bestScoreTable,
  buildSeries,
  compareRecent,
  countWithKeyData,
  difficultyBreakdown,
  formatDuration,
  summarizeDetails,
  summarizeResults,
} from "./stats.js";
import { REVIEW_LIMIT, REVIEW_PLAYS, buildReviewList, indexWords } from "./review.js";
import { jobMasteries } from "./mastery.js";
import { reviewItem } from "./review-item.js";
import { bestKey, createStore, getBackend } from "./storage.js";
import { loadDifficulties } from "./vocabulary.js";

const $ = (selector) => document.querySelector(selector);
const MIN_ATTEMPTS = 10;

const formatDate = (ms) => new Date(ms).toLocaleDateString("ja-JP");
const formatDateTime = (ms) =>
  new Date(ms).toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const round = (value) => String(Math.round(value));
const withCommas = (value) => Math.round(value).toLocaleString("ja-JP");
// 差を「+12」「−3」「±0」の形にする(符号を付けて、色に頼らず増減を示す)
const signed = (value) => {
  const rounded = Math.round(value);
  return rounded === 0 ? "±0" : `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)}`;
};

const NOTICES = {
  unavailable: "この端末(ブラウザ)では記録を保存できないため、成績を表示できません。",
  corrupt: "保存されていたデータが壊れていたため、記録を初期化しました。",
};

const CHARTS = {
  cpm: { title: "入力速度", unit: "打/分", format: round, floor: 0 },
  accuracy: { title: "正確率", unit: "%", format: round, floor: 0, cap: 100 },
  score: { title: "スコア", unit: "点", format: withCommas, floor: 0 },
};

let roles = [];
let jobIds = [];
let jobsById = {};
let rolesById = {};
let difficulties = [];
let difficultiesById = {};
let allResults = [];
// 語の id → 難易度(語録から作る。読み込めるまでは、空)
let difficultyById = new Map();
const filter = { range: 30, roleId: "" };

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} (${response.status})`);
  return response.json();
}

const statTile = (label, value, unit = "") =>
  el(
    "div",
    { class: "stat" },
    el("dt", {}, label),
    el("dd", {}, value, unit ? el("span", { class: "stat__unit" }, ` ${unit}`) : ""),
  );

const keyBadge = (key) => el("kbd", { class: "key" }, key);

function resultLabel(result) {
  return result.status === "cleared" ? "クリア" : "ゲームオーバー";
}

// 連続ノーミス・残り距離・語の難しさ。記録のないもの(以前のプレイだけ・クリアなし)は、「-」で示す
function detailTiles(scope) {
  const details = summarizeDetails(scope);
  return [
    statTile(
      "最大の連続ノーミス",
      details.bestStreak === null ? "-" : String(details.bestStreak),
      details.bestStreak === null ? "" : "語",
    ),
    statTile(
      "平均の残り距離(クリア)",
      details.avgRemaining === null ? "-" : details.avgRemaining.toFixed(1),
      details.avgRemaining === null ? "" : "m",
    ),
    statTile(
      "語の難しさの平均",
      details.avgDifficulty === null ? "-" : details.avgDifficulty.toFixed(1),
    ),
  ];
}

function renderSummary(scope) {
  const summary = summarizeResults(scope);
  $("[data-summary]").replaceChildren(
    statTile("プレイ回数", String(summary.plays), "回"),
    statTile("クリア", `${summary.clears}`, `回(${Math.round(summary.clearRate * 100)}%)`),
    statTile("正解した語数", withCommas(summary.totalWords), "語"),
    statTile("プレイ時間", formatDuration(summary.totalSeconds)),
    statTile("最高の入力速度", round(summary.bestCpm), "打/分"),
    statTile("最高の正確率", round(summary.bestAccuracy), "%"),
    ...detailTiles(scope),
  );

  const { recent, previous } = compareRecent(scope);
  const compare = $("[data-compare]");
  if (recent.count === 0) {
    compare.textContent = "";
    return;
  }
  const head = `直近${recent.count}回の平均: 入力速度 ${round(recent.cpm)}打/分、正確率 ${round(recent.accuracy)}%`;
  compare.textContent = previous
    ? `${head}(その前の${previous.count}回と比べて、入力速度 ${signed(recent.cpm - previous.cpm)}打/分、正確率 ${signed(recent.accuracy - previous.accuracy)}ポイント)`
    : `${head}。その前のプレイがあと少し増えると、変化を比べられます。`;
}

function renderCharts(scope) {
  const describePoint = (point) => ({
    heading: formatDate(point.playedAt),
    detail: `${rolesById[point.roleId]?.name ?? point.roleId}・${jobsById[point.jobId] ?? point.jobId}`,
    result: point.status === "cleared" ? "クリア" : "ゲームオーバー",
  });
  const mixedRoles = new Set(scope.map((r) => r.roleId)).size > 1;

  for (const [metric, config] of Object.entries(CHARTS)) {
    const container = $(`[data-chart="${metric}"]`);
    const points = buildSeries(scope, { metric, limit: scope.length });
    if (points.length < 2) {
      container.__chartObserver?.disconnect();
      container.replaceChildren(
        el(
          "p",
          { class: "chart__empty" },
          `${config.title}の推移は、2回以上のプレイがあると表示されます。`,
        ),
      );
      continue;
    }
    renderLineChart(container, { ...config, points, describePoint });
    // スコアは役職ごとに倍率が違うため、役職をまたぐと比べにくい
    if (metric === "score" && mixedRoles) {
      container
        .querySelector(".chart__title")
        .append(
          el(
            "span",
            { class: "chart__note" },
            " 役職の倍率が違うため、役職を絞ると比べやすくなります",
          ),
        );
    }
  }
}

// ハイスコア表(職種 × 役職 × 難易度の自己ベスト)。期間・役職の絞り込みには、影響されない
// (職種別の熟練度・復習リストと同じ考え。progress.bests は、保存されている結果の件数に関わらず残るため)。
function renderBest(bests) {
  const rows = bestScoreTable(bests, {
    jobIds,
    roleIds: roles.map((role) => role.id),
    difficultyIds: difficulties.map((d) => d.id),
    bestKey,
  });
  $("[data-best-empty]").hidden = rows.length > 0;
  $("[data-best-table]").hidden = rows.length === 0;
  $("[data-best-body]").replaceChildren(
    ...rows.map((row) =>
      el(
        "tr",
        {},
        el("th", { scope: "row" }, rolesById[row.roleId]?.name ?? row.roleId),
        el("td", {}, difficultiesById[row.difficulty]?.name ?? row.difficulty),
        el("td", { class: "data-table__number" }, withCommas(row.score)),
        el("td", {}, jobsById[row.jobId] ?? row.jobId),
        el("td", {}, formatDate(row.playedAt)),
      ),
    ),
  );
}

// 改善記録(自己ベストの更新履歴)。ハイスコア表と同じく、期間・役職の絞り込みには、影響されない
function renderBestHistory() {
  const milestones = bestScoreHistory(allResults, bestKey);
  $("[data-best-history-empty]").hidden = milestones.length > 0;
  $("[data-best-history-list]").hidden = milestones.length === 0;
  $("[data-best-history-list]").replaceChildren(
    ...milestones.map((m) => {
      const label = `${jobsById[m.jobId] ?? m.jobId}・${rolesById[m.roleId]?.name ?? m.roleId}・${difficultiesById[m.difficulty]?.name ?? m.difficulty}`;
      const change =
        m.previousScore === null
          ? "はじめての記録"
          : `自己ベストを更新(前回 ${withCommas(m.previousScore)}点 → ${signed(m.score - m.previousScore)}点)`;
      return el(
        "li",
        { class: "best-history-item" },
        el("p", { class: "best-history-item__head" }, formatDate(m.playedAt), " ", label),
        el(
          "p",
          { class: "best-history-item__score" },
          `${withCommas(m.score)}点`,
          el("span", { class: "best-history-item__change" }, `(${change})`),
        ),
      );
    }),
  );
}

function renderWeakKeys(scope) {
  const total = mergeKeyStats(scope);
  const withData = countWithKeyData(scope);
  const weak = weakKeys(total, { minAttempts: MIN_ATTEMPTS, limit: 8 });
  const confusions = topConfusions(total, 5);

  // どの場合も、キー別の記録が何回分あるか(以前のプレイには無いこと)を伝える
  const coverage = `キー別の記録: ${withData}回分${withData < scope.length ? "。以前のプレイには記録がありません" : ""}`;
  const note = $("[data-weak-note]");
  if (withData === 0) {
    note.textContent =
      "キー別の記録がまだありません。遊ぶと、ミスの多いキーが表示されます。(以前のプレイには、この記録がありません)";
  } else if (weak.length === 0) {
    note.textContent = `ミスのあるキーで、打鍵が${MIN_ATTEMPTS}回以上のものはまだありません。(${coverage})`;
  } else {
    note.textContent = `ミス率の高い順です。打鍵が${MIN_ATTEMPTS}回以上のキーだけを表示します。(${coverage})`;
  }

  $("[data-weak-list]").replaceChildren(
    ...weak.map((item) => {
      const percent = Math.round(item.rate * 100);
      const fill = el("span", { class: "key-bar__fill" });
      fill.style.width = `${Math.max(2, percent)}%`;
      return el(
        "li",
        { class: "key-bar" },
        keyBadge(item.key),
        el("span", { class: "key-bar__track", "aria-hidden": "true" }, fill),
        el(
          "span",
          { class: "key-bar__text" },
          `ミス率 ${percent}%(${item.attempts}回中${item.misses}回)`,
        ),
      );
    }),
  );

  $("[data-confusion-empty]").hidden = confusions.length > 0;
  $("[data-confusion-list]").replaceChildren(
    ...confusions.map(({ expected, typed, count }) =>
      el("li", {}, keyBadge(expected), " のところで ", keyBadge(typed), ` を打った ${count}回`),
    ),
  );
}

// 難易度別のミス: 難易度ごとの語数の記録があるプレイだけを使う(以前のプレイには、記録がない)
function renderDifficulty(scope) {
  const { rows, plays } = difficultyBreakdown(scope, (id) => difficultyById.get(id));
  const note = $("[data-difficulty-note]");
  const table = $("[data-difficulty-table]");
  table.hidden = rows.length === 0;
  if (difficultyById.size === 0) {
    note.textContent = "語録を読み込んでいます。";
    table.hidden = true;
    return;
  }
  if (plays === 0) {
    note.textContent =
      "難易度別の記録がまだありません。遊ぶと、難易度ごとのミスが表示されます。(以前のプレイには、この記録がありません)";
    return;
  }
  const missing = scope.length - plays;
  note.textContent = `難易度別の記録: ${plays}回分${missing > 0 ? "。以前のプレイには記録がありません" : ""}。ミスは、語ごとのミスの回数を、語の難易度で分けています(1語で何回ミスしても、その回数だけ数えます)。`;
  $("[data-difficulty-body]").replaceChildren(
    ...rows.map((row) =>
      el(
        "tr",
        {},
        el("th", { scope: "row" }, `${row.label}(難易度${row.difficulty})`),
        el("td", { class: "data-table__number" }, `${row.words}語`),
        el("td", { class: "data-table__number" }, `${row.misses}回`),
        el(
          "td",
          { class: "data-table__number" },
          row.perWord === null ? "-" : `${row.perWord.toFixed(2)}回`,
        ),
      ),
    ),
  );
}

function renderRecent(scope) {
  $("[data-recent-body]").replaceChildren(
    ...scope
      .slice(0, 10)
      .map((result) =>
        el(
          "tr",
          {},
          el("th", { scope: "row" }, formatDateTime(result.playedAt)),
          el(
            "td",
            {},
            `${jobsById[result.jobId] ?? result.jobId}・${rolesById[result.roleId]?.name ?? result.roleId}`,
          ),
          el("td", {}, resultLabel(result)),
          el("td", { class: "data-table__number" }, withCommas(result.score)),
          el("td", { class: "data-table__number" }, `${round(result.cps * 60)}打/分`),
          el(
            "td",
            { class: "data-table__number" },
            result.hits + result.miss > 0 ? `${round(result.accuracy * 100)}%` : "-",
          ),
          el(
            "td",
            { class: "data-table__number" },
            result.streak === null ? "-" : `${result.streak}語`,
          ),
          el(
            "td",
            { class: "data-table__number" },
            result.status === "cleared" ? `${Math.round(result.distance * 10) / 10}m` : "-",
          ),
        ),
      ),
  );
}

// 職種別の熟練度: 打ち終えた語数とクリア数(進行状況。すべてのプレイから)。期間・役職の絞り込みには、影響されない
function renderMastery(progressJobs) {
  const masteries = jobMasteries(progressJobs, jobIds);
  $("[data-mastery-list]").replaceChildren(
    ...masteries.map((mastery) => {
      const percent = Math.round(mastery.ratio * 100);
      const fill = el("span", { class: "key-bar__fill" });
      fill.style.width = `${Math.max(2, percent)}%`;
      const nextText = mastery.next
        ? `次は${mastery.next.name}(語数あと${mastery.next.wordsLeft}・クリアあと${mastery.next.clearsLeft})`
        : "最高段階です";
      return el(
        "li",
        { class: "key-bar" },
        el(
          "span",
          { class: "mastery-list__job" },
          jobsById[mastery.id] ?? mastery.id,
          " ",
          el("span", { class: "badge badge--live" }, mastery.name),
        ),
        el("span", { class: "key-bar__track", "aria-hidden": "true" }, fill),
        el(
          "span",
          { class: "key-bar__text" },
          `${mastery.words}語・${mastery.clears}回クリア。${nextText}`,
        ),
      );
    }),
  );
}

// 復習リスト: 直近のプレイでミスした語。期間・役職の絞り込みには、影響されない
function renderReview(vocabularies) {
  const list = buildReviewList(allResults, indexWords(vocabularies));
  $("[data-review-list]").replaceChildren(
    ...list.map(({ word, jobId, misses }) =>
      reviewItem({ word, misses, jobName: jobsById[jobId] ?? jobId }),
    ),
  );
  $("[data-review-list]").hidden = list.length === 0;
  $("[data-review-action]").hidden = list.length === 0;
  $("[data-review-note]").textContent =
    list.length === 0
      ? "復習する語は、まだありません。連続タイピングでミスすると、ここに出ます。"
      : `直近${Math.min(allResults.length, REVIEW_PLAYS)}プレイでミスした語を、ミスの多い順に並べています(最大${REVIEW_LIMIT}語。期間・役職の絞り込みの影響は受けません。用語確認の結果は、含みません)。`;
  $("[data-review-start]").textContent = `復習リストで用語確認をする(${list.length}語)`;
}

function render() {
  const filtered = allResults.filter((r) => !filter.roleId || r.roleId === filter.roleId);
  const scope = filtered.slice(0, filter.range);

  $("[data-scope-note]").textContent =
    `${filter.roleId ? `${rolesById[filter.roleId].name}を対象に、` : ""}新しい順に${scope.length}回分を表示しています(保存されているのは直近${allResults.length}回分)。`;
  $("[data-no-scope]").hidden = scope.length > 0;
  $("[data-scoped]").hidden = scope.length === 0;
  if (scope.length === 0) {
    $("[data-scope-note]").textContent = "";
    return;
  }
  renderSummary(scope);
  renderCharts(scope);
  renderDifficulty(scope);
  renderWeakKeys(scope);
  renderRecent(scope);
}

async function init() {
  const store = createStore(getBackend());
  const { data, status } = store.load();
  const notice = NOTICES[status];
  $("[data-storage-notice]").textContent = notice ?? "";
  $("[data-storage-notice]").hidden = !notice;

  allResults = data.results;
  if (allResults.length === 0) {
    $("[data-empty]").hidden = false;
    return;
  }
  try {
    const [jobs, loadedRoles, loadedDifficulties] = await Promise.all([
      loadJson("/data/jobs.json"),
      loadJson("/data/roles.json"),
      loadDifficulties(),
    ]);
    roles = loadedRoles;
    difficulties = loadedDifficulties;
    jobIds = jobs.map((job) => job.id);
    jobsById = Object.fromEntries(jobs.map((job) => [job.id, job.name]));
    rolesById = Object.fromEntries(roles.map((role) => [role.id, role]));
    difficultiesById = Object.fromEntries(difficulties.map((d) => [d.id, d]));
    renderMastery(data.progress.jobs);
    renderBest(data.progress.bests);
    renderBestHistory();
  } catch {
    const error = $("[data-error]");
    error.textContent = "データを読み込めませんでした。ページを再読み込みしてください。";
    error.hidden = false;
    return;
  }

  $("[data-filter-role]").replaceChildren(
    el("option", { value: "" }, "すべて"),
    ...roles.map((role) => el("option", { value: role.id }, role.name)),
  );
  $("[data-filter-range]").addEventListener("change", (event) => {
    filter.range = Number(event.target.value);
    render();
  });
  $("[data-filter-role]").addEventListener("change", (event) => {
    filter.roleId = event.target.value;
    render();
  });

  $("[data-content]").hidden = false;
  render();

  // 復習リストは、語録から語の説明を引く(読み込めなくても、ほかの成績は、そのまま見られる)
  try {
    const vocabularies = await Promise.all(
      Object.keys(jobsById).map((jobId) => loadJson(`/data/vocabulary/${jobId}.json`)),
    );
    difficultyById = new Map(
      vocabularies.flatMap((vocabulary) =>
        (vocabulary.items ?? []).map((item) => [item.id, item.difficulty]),
      ),
    );
    render();
    renderReview(vocabularies);
  } catch {
    $("[data-review-note]").textContent =
      "復習リストを読み込めませんでした。ページを再読み込みしてください。";
    $("[data-review-list]").hidden = true;
    $("[data-review-action]").hidden = true;
    $("[data-difficulty-note]").textContent =
      "語録を読み込めませんでした。ページを再読み込みしてください。";
  }
}

init();
