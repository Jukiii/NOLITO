// ハイスコア表・改善記録(Phase 18 PR 4)の、成績ページ(HTML・stats-page.js)のつなぎのテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const html = read("public/games/escape-boss/stats/index.html");
const page = read("public/assets/js/games/escape-boss/stats-page.js");

describe("ハイスコア・改善記録の HTML", () => {
  it("ハイスコア表は、職種別の熟練度のすぐあと(絞り込みの前)にある。期間・役職の絞り込みの影響を受けない", () => {
    const filterAt = html.indexOf('class="filter-row"');
    const bestAt = html.indexOf("data-best>");
    const masteryEnd = html.indexOf("</section>", html.indexOf("data-mastery>"));
    assert.ok(bestAt > masteryEnd && bestAt < filterAt, "mastery の直後・filter の前にある");
    assert.match(html, /<h2 id="best-title">ハイスコア<\/h2>/);
    assert.match(html, /<th scope="col">難易度<\/th>/);
  });

  it("改善記録は、ハイスコア表のすぐあと(絞り込みの前)にある", () => {
    const filterAt = html.indexOf('class="filter-row"');
    const historyAt = html.indexOf("data-best-history>");
    const bestEnd = html.indexOf("</section>", html.indexOf("data-best>"));
    assert.ok(historyAt > bestEnd && historyAt < filterAt);
    assert.match(html, /<h2 id="best-history-title">改善記録<\/h2>/);
    for (const hook of ["data-best-history-empty", "data-best-history-list"]) {
      assert.ok(html.includes(hook), hook);
    }
  });
});

describe("stats-page.js のつなぎ(ハイスコア・改善記録)", () => {
  it("bestKey・loadDifficulties・bestScoreTable・bestScoreHistory を使う", () => {
    assert.match(page, /import \{ bestKey, createStore, getBackend \} from "\.\/storage\.js";/);
    assert.match(page, /import \{ loadDifficulties \} from "\.\/vocabulary\.js";/);
    assert.match(page, /import \{\s*bestScoreHistory,\s*bestScoreTable,/);
  });

  it("renderBest・renderBestHistory は、init から1回だけ呼ぶ(render からは呼ばない。絞り込みの影響を受けない)", () => {
    const init = page.slice(page.indexOf("async function init"));
    assert.match(init, /renderBest\(data\.progress\.bests\)/);
    assert.match(init, /renderBestHistory\(\)/);
    const renderFn = page.slice(
      page.indexOf("function render()"),
      page.indexOf("async function init"),
    );
    assert.ok(!/renderBest\(|renderBestHistory\(/.test(renderFn));
  });

  it("renderBest: 役職・難易度・スコア・職種・日付を、textContent で入れる(innerHTML を使わない)", () => {
    const fn = page.slice(
      page.indexOf("function renderBest(bests)"),
      page.indexOf("function renderBestHistory"),
    );
    assert.match(fn, /bestScoreTable\(bests, \{/);
    assert.ok(!/innerHTML/.test(fn));
  });

  it("renderBestHistory: 自己ベストが初めてか、更新かで、文言を変える", () => {
    const fn = page.slice(
      page.indexOf("function renderBestHistory"),
      page.indexOf("function renderWeakKeys") > 0
        ? page.indexOf("function renderWeakKeys")
        : undefined,
    );
    assert.match(fn, /はじめての記録/);
    assert.match(fn, /自己ベストを更新/);
    assert.ok(!/innerHTML/.test(fn));
  });
});
