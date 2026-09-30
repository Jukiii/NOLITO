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

describe("難易度は、追ってくる人(役職)と同じ(Issue #144)", () => {
  it("開始前の選択に、難易度の選択欄はない。役職の選択に、難易度の意味を添える", () => {
    for (const hook of ["data-difficulty-list", "data-difficulty-fieldset", "setup-difficulty"]) {
      assert.ok(!html.includes(hook), hook);
    }
    assert.ok(html.includes("追ってくる人(役職が上がるほど、むずかしい)"));
    assert.match(html, /data-role-best hidden/);
  });

  it("ランキングに、役職と対になる難易度の選択欄がある(役職の下)", () => {
    const start = html.indexOf('id="ranking-role"');
    const section = html.slice(start, html.indexOf("</section>", start));
    assert.match(section, /<label for="ranking-difficulty">難易度<\/label>/);
    assert.match(section, /id="ranking-difficulty"[\s\S]*?data-ranking-difficulty/);
  });
});

describe("view.js のつなぎ(難易度)", () => {
  it("難易度の選択の描画・イベントは、なくなった。自己ベストは、役職の欄で更新する", () => {
    for (const gone of ["renderDifficultyList", "updateDifficultyInfo", "data-difficulty-list"]) {
      assert.ok(!view.includes(gone), gone);
    }
    const fn = view.slice(
      view.indexOf("function updateBest"),
      view.indexOf("function renderSetup"),
    );
    assert.match(fn, /bestOfJob\(jobId, roleId, DEFAULT_DIFFICULTY\)/);
    assert.ok(!/innerHTML/.test(fn));
    assert.match(view, /\$\("\[data-job-list\]"\)\.addEventListener\("change", updateBest\);/);
    assert.match(
      view,
      /\$\("\[data-role-list\]"\)\.addEventListener\("change", \(\) => \{\s*updateRoleRules\(\);\s*updateBest\(\);\s*\}\);/,
    );
  });

  it("開始の送信は、いつも既定の難易度(ふつう)を onStart に渡す", () => {
    const start = view.indexOf('addEventListener("submit"');
    const submit = view.slice(start, view.indexOf("});", start) + 3);
    assert.match(submit, /onStart\(\{ mode, jobId, roleId, difficulty: DEFAULT_DIFFICULTY \}\)/);
  });

  it("ランキングの難易度の選択欄は、変わるたびに onRankingDifficultyChange を呼ぶ", () => {
    assert.match(
      view,
      /\$\("\[data-ranking-difficulty\]"\)\.addEventListener\("change", \(event\) =>\s*onRankingDifficultyChange\(event\.target\.value\),?\s*\);/,
    );
  });

  it("renderDashboard: bestOf を renderSetup に渡す。ランキングの難易度欄は rankable だけ", () => {
    const fn = view.slice(view.indexOf("renderDashboard({"), view.indexOf("renderRanking,"));
    assert.match(fn, /renderSetup\(\{\s*jobs,\s*roles,\s*isUnlocked,\s*bestOf,/);
    assert.match(fn, /rankingDifficultyId,/);
    assert.match(fn, /difficulty\.rankable/);
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

  it("ランキングは、役職と難易度の組で読む(getRanking の第三引数)", () => {
    assert.match(main, /getRanking\(store\.load\(\)\.data, roleId, rankingDifficultyId\)/);
    assert.match(
      main,
      /onRankingDifficultyChange: \(difficultyId\) => \{\s*rankingDifficultyId = difficultyId;/,
    );
  });
});
