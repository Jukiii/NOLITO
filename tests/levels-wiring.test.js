// 経験値・レベル・職種別熟練度(Phase 18 PR 1)の、画面(HTML・view.js・stats-page.js)と main.js のつなぎのテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const html = read("public/games/escape-boss/index.html");
const statsHtml = read("public/games/escape-boss/stats/index.html");
const view = read("public/assets/js/games/escape-boss/view.js");
const main = read("public/assets/js/games/escape-boss/main.js");
const statsPage = read("public/assets/js/games/escape-boss/stats-page.js");
const records = read("public/assets/js/games/escape-boss/records.js");

describe("プレイヤー欄(レベル・経験値)の HTML", () => {
  it("レベルの数・最高レベルの注記・バー(role=progressbar)・文が、プレイヤー欄にある", () => {
    const start = html.indexOf('id="profile-title"');
    const section = html.slice(start, html.indexOf("<form", start));
    assert.match(section, /<strong data-level>1<\/strong>/);
    assert.match(section, /<span data-level-max hidden>/);
    assert.match(section, /role="progressbar"/);
    assert.match(section, /data-level-bar/);
    assert.match(section, /data-level-fill/);
    assert.match(section, /data-level-text/);
  });

  it("バーの aria-labelledby は、プレイヤー欄の見出しを指す(読み上げに、意味が伝わる)", () => {
    assert.match(html, /role="progressbar"\s*\n\s*aria-labelledby="profile-title"/);
  });
});

describe("結果画面(獲得経験値・レベルアップ)の HTML", () => {
  it("獲得経験値と、レベルアップの知らせ(読み上げの領域)が、スコアの下にある", () => {
    const result = html.slice(
      html.indexOf('data-view="result"'),
      html.indexOf("data-result-analysis"),
    );
    assert.match(
      result,
      /data-result-score[\s\S]*?data-result-exp[\s\S]*?data-result-levelup hidden/,
    );
    assert.match(result, /<p class="result-exp" role="status" data-result-exp><\/p>/);
    assert.match(
      result,
      /<p class="result-exp result-exp--levelup" role="status" data-result-levelup hidden><\/p>/,
    );
  });
});

describe("職種選択(熟練度)と、成績ページ(職種別の熟練度)の HTML", () => {
  it("成績ページに、職種別の熟練度のセクションがある。絞り込み(filter-row)より前(期間・役職の影響を受けない)", () => {
    assert.match(statsHtml, /<h2 id="mastery-title">職種別の熟練度<\/h2>/);
    assert.match(statsHtml, /<ul class="mastery-list" data-mastery-list><\/ul>/);
    assert.ok(statsHtml.indexOf("data-mastery-list") < statsHtml.indexOf('class="filter-row"'));
  });
});

describe("view.js のつなぎ", () => {
  it("renderSetup は、masteries を受け取り、職種の選択肢に、熟練度の段階を sub として出す", () => {
    const setup = view.slice(
      view.indexOf("function renderSetup"),
      view.indexOf("function renderProfile"),
    );
    assert.match(setup, /masteries = \[\]/);
    assert.match(setup, /masteryById\.get\(job\.id\)\?\.name/);
  });

  it("renderLevel: レベル・バーの割合・文を、data 属性に反映する。文字は el()(textContent)相当だけ", () => {
    const fn = view.slice(
      view.indexOf("function renderLevel"),
      view.indexOf("function renderProfile"),
    );
    assert.match(fn, /setText\("\[data-level\]", level\.level\)/);
    assert.match(fn, /\$\("\[data-level-bar\]"\)\.setAttribute\("aria-valuenow"/);
    assert.match(fn, /\$\("\[data-level-fill\]"\)\.style\.width/);
    assert.match(fn, /累計の経験値|次のレベルまで/);
  });

  it("renderDashboard は、level・masteries を受け取り、renderSetup・renderLevel に渡す", () => {
    const fn = view.slice(view.indexOf("renderDashboard({"), view.indexOf("renderRanking,"));
    assert.match(fn, /level,\s*masteries,/);
    assert.match(fn, /renderSetup\(\{ jobs, roles, isUnlocked, masteries \}\);/);
    assert.match(fn, /renderLevel\(level\);/);
  });

  it("showResult は、獲得経験値を出し、レベルアップのときだけ、その文を出す", () => {
    const start = view.indexOf("showResult({");
    const fn = view.slice(start, view.indexOf("renderAnalysis(analysis);", start));
    assert.match(fn, /expGained = 0,/);
    assert.match(fn, /levelUp = null,/);
    assert.match(fn, /setText\("\[data-result-exp\]", `経験値 \+\$\{expGained\}`\)/);
    assert.match(fn, /levelupNode\.hidden = !levelUp;/);
    assert.match(fn, /if \(levelUp\)\s*setText\("\[data-result-levelup\]"/);
  });

  it("文字は、すべて el()・setText(textContent)で入れる(innerHTML を使わない)", () => {
    assert.ok(!/innerHTML/.test(view));
  });
});

describe("main.js のつなぎ", () => {
  it("refreshDashboard は、levelOf・jobMasteries を使って、renderDashboard に渡す", () => {
    assert.match(main, /import \{ levelOf \} from "\.\/levels\.js";/);
    assert.match(main, /import \{ jobMasteries \} from "\.\/mastery\.js";/);
    const fn = main.slice(
      main.indexOf("function refreshDashboard"),
      main.indexOf("async function init"),
    );
    assert.match(fn, /level: levelOf\(data\.progress\.exp\)/);
    assert.match(fn, /masteries: jobMasteries\(/);
  });

  it("結果(result)は、難易度(difficulty)を持つ。Phase 18 PR 1 の間は「ふつう」だけ", () => {
    assert.match(main, /import \{ DEFAULT_DIFFICULTY \} from "\.\/difficulty\.js";/);
    const finish = main.slice(
      main.indexOf("function finish()"),
      main.indexOf("function beginOutro"),
    );
    assert.match(finish, /difficulty: DEFAULT_DIFFICULTY,/);
  });

  it("finish は、recordResult の進行状況で実績を判定してから、grantExp で経験値を加える(新しい実績の数を渡す)", () => {
    const finish = main.slice(
      main.indexOf("function finish()"),
      main.indexOf("function beginOutro"),
    );
    const recordAt = finish.indexOf("recordResult(");
    const evalAt = finish.indexOf("evaluateAchievements(");
    const grantAt = finish.indexOf("grantExp(");
    assert.ok(recordAt >= 0 && evalAt > recordAt && grantAt > evalAt);
    assert.match(
      finish,
      /grantExp\(recorded\.progress, result, \{\s*newAchievements: ids\.length,/,
    );
  });

  it("showResult には、grantExp が返す獲得経験値・レベルアップが、そのまま渡る", () => {
    assert.match(main, /const \{ gained: expGained, levelUp \} = out;/);
    const view_call = main.slice(
      main.indexOf("const resultView = {"),
      main.indexOf("const cleared ="),
    );
    assert.match(view_call, /expGained,/);
    assert.match(view_call, /levelUp,/);
  });
});

describe("stats-page.js のつなぎ(職種別の熟練度)", () => {
  it("init は、進行状況の職種ごとの合計(data.progress.jobs)から、renderMastery を呼ぶ", () => {
    assert.match(statsPage, /import \{ jobMasteries \} from "\.\/mastery\.js";/);
    assert.match(statsPage, /renderMastery\(data\.progress\.jobs\);/);
  });

  it("renderMastery は、期間・役職の絞り込み(filter)を、引数に取らない(影響を受けない)", () => {
    const fn = statsPage.slice(
      statsPage.indexOf("function renderMastery"),
      statsPage.indexOf("// 復習リスト"),
    );
    assert.ok(!/filter\./.test(fn));
  });

  it("文字は、すべて el() で入れる", () => {
    const fn = statsPage.slice(
      statsPage.indexOf("function renderMastery"),
      statsPage.indexOf("// 復習リスト"),
    );
    assert.ok(!/innerHTML/.test(fn));
  });
});

describe("records.js: 記録の形・版は、CLAUDE.md の決まりを守る", () => {
  it("grantExp は、実績の判定のあとに呼ぶ設計(進行状況を受け取り、進行状況を返す。DOM・保存に触れない)", () => {
    assert.ok(!/\b(document|window|localStorage|fetch)\b/.test(records));
  });

  it("自己ベスト・難易度ごとのクリア数の名前は、storage.js の clearKey・bestKey で作る(重複した書式を持たない)", () => {
    assert.match(
      records,
      /import \{[^}]*\bbestKey\b[^}]*\bclearKey\b[^}]*\} from "\.\/storage\.js";|import \{[^}]*\bclearKey\b[^}]*\bbestKey\b[^}]*\} from "\.\/storage\.js";/,
    );
  });
});
