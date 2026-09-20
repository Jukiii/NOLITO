// 成績ページ。保存された記録(端末内)を読み、累計・成長グラフ・苦手なキー・最近のプレイを表示する。
// 表示は「追ってくる人」と「対象の回数」の絞り込みに従って、ページ全体を同じ範囲で描き直す。
// 文字列(語録・ニックネーム由来の値を含む)は、すべて textContent で入れる。
import { el } from "../../components/dom.js";
import { renderLineChart } from "./chart.js";
import { mergeKeyStats, topConfusions, weakKeys } from "./keystats.js";
import {
  bestScoresByRole,
  buildSeries,
  compareRecent,
  countWithKeyData,
  formatDuration,
  summarizeResults,
} from "./stats.js";
import { REVIEW_LIMIT, REVIEW_PLAYS, buildReviewList, indexWords } from "./review.js";
import { reviewItem } from "./review-item.js";
import { createStore, getBackend } from "./storage.js";

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
let jobsById = {};
let rolesById = {};
let allResults = [];
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

function renderSummary(scope) {
  const summary = summarizeResults(scope);
  $("[data-summary]").replaceChildren(
    statTile("プレイ回数", String(summary.plays), "回"),
    statTile("クリア", `${summary.clears}`, `回(${Math.round(summary.clearRate * 100)}%)`),
    statTile("正解した語数", withCommas(summary.totalWords), "語"),
    statTile("プレイ時間", formatDuration(summary.totalSeconds)),
    statTile("最高の入力速度", round(summary.bestCpm), "打/分"),
    statTile("最高の正確率", round(summary.bestAccuracy), "%"),
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

function renderBest(scope) {
  const best = bestScoresByRole(scope);
  const rows = roles.filter((role) => best[role.id]);
  $("[data-best-empty]").hidden = rows.length > 0;
  $("[data-best-table]").hidden = rows.length === 0;
  $("[data-best-body]").replaceChildren(
    ...rows.map((role) =>
      el(
        "tr",
        {},
        el("th", { scope: "row" }, role.name),
        el("td", { class: "data-table__number" }, withCommas(best[role.id].score)),
        el("td", {}, jobsById[best[role.id].jobId] ?? best[role.id].jobId),
        el("td", {}, formatDate(best[role.id].playedAt)),
      ),
    ),
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
        ),
      ),
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
  renderBest(scope);
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
    const [jobs, loadedRoles] = await Promise.all([
      loadJson("/data/jobs.json"),
      loadJson("/data/roles.json"),
    ]);
    roles = loadedRoles;
    jobsById = Object.fromEntries(jobs.map((job) => [job.id, job.name]));
    rolesById = Object.fromEntries(roles.map((role) => [role.id, role]));
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
    renderReview(vocabularies);
  } catch {
    $("[data-review-note]").textContent =
      "復習リストを読み込めませんでした。ページを再読み込みしてください。";
    $("[data-review-list]").hidden = true;
    $("[data-review-action]").hidden = true;
  }
}

init();
