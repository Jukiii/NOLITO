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

describe("難易度選択の HTML", () => {
  it("役職の選択の後に、難易度のフィールドセットがある(役職と同じく、用語確認では隠れる)", () => {
    const fieldset = html.slice(
      html.indexOf("data-difficulty-fieldset"),
      html.indexOf("data-explanation-option"),
    );
    assert.match(fieldset, /<legend>難易度を選ぶ<\/legend>/);
    assert.match(fieldset, /data-difficulty-list/);
    assert.match(fieldset, /data-difficulty-hint hidden/);
    assert.match(
      fieldset,
      /<div class="game-setup__rules" aria-live="polite" data-difficulty-info hidden>/,
    );
    assert.ok(
      fieldset.includes("data-difficulty-info-text") && fieldset.includes("data-difficulty-best"),
    );
  });

  it("ランキングに、役職と対になる難易度の選択欄がある(役職の下)", () => {
    const start = html.indexOf('id="ranking-role"');
    const section = html.slice(start, html.indexOf("</section>", start));
    assert.match(section, /<label for="ranking-difficulty">難易度<\/label>/);
    assert.match(section, /id="ranking-difficulty"[\s\S]*?data-ranking-difficulty/);
  });
});

describe("view.js のつなぎ(難易度)", () => {
  it("difficulty.js から DEFAULT_DIFFICULTY を使う。用語確認では、難易度のフィールドセットも隠す", () => {
    assert.match(view, /import \{ DEFAULT_DIFFICULTY \} from "\.\/difficulty\.js";/);
    const apply = view.slice(view.indexOf("function applyMode"), view.indexOf("function option"));
    assert.match(apply, /\$\("\[data-difficulty-fieldset\]"\)\.hidden = check;/);
  });

  it("renderDifficultyList: 役職ごとに挑戦できるかを見て、作り直す。ロックは badge で示す", () => {
    const fn = view.slice(
      view.indexOf("function renderDifficultyList"),
      view.indexOf("function updateDifficultyInfo"),
    );
    assert.match(fn, /difficultyUnlockOf\(difficulty, roleId\)/);
    assert.match(fn, /disabled: !unlocked\(difficulty\)/);
    assert.match(fn, /badge: unlocked\(difficulty\) \? "" : "ロック中"/);
    assert.match(fn, /updateDifficultyInfo\(\);/);
  });

  it("updateDifficultyInfo: 説明・経験値の倍率・自己ベスト(あれば)を出す。文字は textContent 相当だけ", () => {
    const fn = view.slice(
      view.indexOf("function updateDifficultyInfo"),
      view.indexOf("function renderSetup"),
    );
    assert.match(fn, /difficulty\.description/);
    assert.match(fn, /difficulty\.exp_multiplier/);
    assert.match(fn, /bestOfJob\(jobId, roleId, difficulty\.id\)/);
    assert.ok(!/innerHTML/.test(fn));
  });

  it("役職・職種・難易度を選び直すたびに、確認欄を更新する", () => {
    assert.match(
      view,
      /\$\("\[data-job-list\]"\)\.addEventListener\("change", updateDifficultyInfo\);/,
    );
    assert.match(
      view,
      /\$\("\[data-role-list\]"\)\.addEventListener\("change", \(\) => \{\s*updateRoleRules\(\);\s*renderDifficultyList\(\);\s*\}\);/,
    );
    assert.match(
      view,
      /\$\("\[data-difficulty-list\]"\)\.addEventListener\("change", updateDifficultyInfo\);/,
    );
  });

  it("開始の送信は、選んだ難易度(なければ既定)を、onStart に渡す", () => {
    const start = view.indexOf('addEventListener("submit"');
    const submit = view.slice(start, view.indexOf("});", start) + 3);
    assert.match(
      submit,
      /const difficulty = checkedValue\("difficulty"\) \?\? DEFAULT_DIFFICULTY;/,
    );
    assert.match(submit, /onStart\(\{ mode, jobId, roleId, difficulty \}\)/);
  });

  it("ランキングの難易度の選択欄は、変わるたびに onRankingDifficultyChange を呼ぶ", () => {
    assert.match(
      view,
      /\$\("\[data-ranking-difficulty\]"\)\.addEventListener\("change", \(event\) =>\s*onRankingDifficultyChange\(event\.target\.value\),?\s*\);/,
    );
  });

  it("renderDashboard: difficulties・isDifficultyUnlocked・bestOf を、renderSetup に渡す。ランキングの難易度欄は rankable だけ", () => {
    const fn = view.slice(view.indexOf("renderDashboard({"), view.indexOf("renderRanking,"));
    assert.match(fn, /difficulties,\s*isDifficultyUnlocked,\s*bestOf,/);
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
