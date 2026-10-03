// 難易度の選択・開始前の確認欄(Phase 18 PR 2)の、画面(HTML・view.js)と main.js のつなぎのテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const html = read("public/games/escape-boss/index.html");
const view = read("public/assets/js/games/escape-boss/view.js");
const main = read("public/assets/js/games/escape-boss/main.js");
const profileHtml = read("public/games/escape-boss/profile/index.html");
const profilePage = read("public/assets/js/games/escape-boss/profile-page.js");

describe("難易度の選択(Issue #173。0061 の「難易度 = 役職」を、選択欄の復活で置き換え)", () => {
  it("開始前の選択に、職種・追ってくる人と並んで、難易度の選択欄がある", () => {
    for (const hook of [
      "data-difficulty-list",
      "data-difficulty-fieldset",
      "data-difficulty-hint",
    ]) {
      assert.ok(html.includes(hook), hook);
    }
    assert.match(html, /<label for="setup-difficulty">難易度<\/label>/);
    assert.ok(html.indexOf("data-role-list") < html.indexOf("data-difficulty-list"));
    assert.match(html, /data-role-best hidden/);
  });

  it("ランキングに、役職と対になる難易度の選択欄がある(役職の下)", () => {
    const start = profileHtml.indexOf('id="ranking-role"');
    const section = profileHtml.slice(start, profileHtml.indexOf("</section>", start));
    assert.match(section, /<label for="ranking-difficulty">難易度<\/label>/);
    assert.match(section, /id="ranking-difficulty"[\s\S]*?data-ranking-difficulty/);
  });
});

describe("view.js のつなぎ(難易度)", () => {
  it("難易度の描画・イベントがある。役職を選び直すと、難易度のロック状態を作り直す", () => {
    for (const name of ["renderDifficultyList", "updateDifficultyInfo", "data-difficulty-list"]) {
      assert.ok(view.includes(name), name);
    }
    const fn = view.slice(
      view.indexOf("function renderDifficultyList"),
      view.indexOf("function renderSetup"),
    );
    assert.match(fn, /bestOfJob\(jobId, roleId, difficultyId\)/);
    assert.ok(!/innerHTML/.test(fn));
    assert.match(view, /\$\("\[data-job-list\]"\)\.addEventListener\("change", updateBest\);/);
    assert.match(
      view,
      /\$\("\[data-role-list\]"\)\.addEventListener\("change", \(\) => \{\s*updateRoleRules\(\);\s*renderDifficultyList\(\);\s*\}\);/,
    );
    assert.match(
      view,
      /\$\("\[data-difficulty-list\]"\)\.addEventListener\("change", updateDifficultyInfo\);/,
    );
  });

  it("開始の送信は、選んでいる難易度を onStart に渡す(なければ既定のふつう)", () => {
    const start = view.indexOf('addEventListener("submit"');
    const submit = view.slice(start, view.indexOf("});", start) + 3);
    assert.match(submit, /checkedValue\("difficulty"\) \?\? DEFAULT_DIFFICULTY/);
    assert.match(submit, /onStart\(\{ mode, jobId, roleId, difficulty \}\)/);
  });

  it("用語確認では、難易度の選択欄を隠す", () => {
    const fn = view.slice(view.indexOf("function applyMode"), view.indexOf("function option"));
    assert.match(fn, /\[data-difficulty-fieldset\]"\)\.hidden = check/);
  });

  it("renderDashboard: difficulties・isDifficultyUnlocked・bestOf を renderSetup に渡す", () => {
    const fn = view.slice(
      view.indexOf("renderDashboard({"),
      view.indexOf("// 「プレイ中に、用語の説明も"),
    );
    assert.match(fn, /renderSetup\(\{[\s\S]*?difficulties,\s*isDifficultyUnlocked,\s*bestOf,/);
  });
});

describe("view.js: 結果画面のランキング表示(難易度)", () => {
  it("ランキング対象外の難易度は、圏外(競って負けた)ではなく、対象外だと出す", () => {
    const start = view.indexOf("showResult({");
    const fn = view.slice(start, view.indexOf('$("[data-result-title]").focus();', start));
    assert.match(fn, /rankable = true,/);
    assert.match(fn, /!rankable\s*\n?\s*\?\s*"ランキング対象外/);
  });
});

describe("main.js のつなぎ(難易度)", () => {
  it("init は、loadDifficulties を読み込む", () => {
    assert.match(main, /import \{\s*loadDifficulties,/);
    const init = main.slice(main.indexOf("async function init"), main.indexOf("// 音の設定"));
    assert.match(init, /loadDifficulties\(\)/);
  });

  it("isDifficultyUnlockedFor は、difficulty.js の isDifficultyUnlocked に、進行状況と clearKey を渡す", () => {
    assert.match(
      main,
      /isDifficultyUnlocked as checkDifficultyUnlocked,?\s*\} from "\.\/difficulty\.js";/,
    );
    assert.match(
      main,
      /const isDifficultyUnlockedFor = \(difficulty, roleId\) =>\s*checkDifficultyUnlocked\(difficulty, \{/,
    );
  });

  it("beginGame: 難易度を探し、役職と同じく、挑戦できるかを確認してから、applyDifficulty で stage を作る", () => {
    const fn = main.slice(main.indexOf("async function beginGame"), main.indexOf("// 開始の演出"));
    assert.match(fn, /isDifficultyUnlockedFor\(difficulty, role\.id\)/);
    assert.match(fn, /const stage = applyDifficulty\(role\.stage, difficulty\);/);
    assert.match(fn, /difficulty: difficulty\.id,/);
  });

  it("finish: 結果の難易度は session.difficulty。grantExp に、その難易度の経験値の倍率を渡す", () => {
    const finish = main.slice(
      main.indexOf("function finish()"),
      main.indexOf("function beginOutro"),
    );
    assert.match(finish, /difficulty: session\.difficulty,/);
    assert.match(finish, /multiplier: difficulty\.exp_multiplier,/);
    assert.match(finish, /rankable: difficulty\.rankable,/);
  });

  it("retry は、同じ難易度で、もう一度始める", () => {
    assert.match(
      main,
      /startGame\(\{ jobId: session\.job\.id, roleId: session\.role\.id, difficulty: session\.difficulty \}\)/,
    );
  });

  it("ランキングは、プレイヤー・記録のページで、役職と難易度の組で読む(getRanking の第三引数)", () => {
    assert.match(
      profilePage,
      /getRanking\(store\.load\(\)\.data, rankingRoleId, rankingDifficultyId\)/,
    );
    assert.ok(!/getRanking/.test(main));
  });
});
