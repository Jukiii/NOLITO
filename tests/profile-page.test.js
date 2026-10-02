// プレイヤー・記録のページ(/games/escape-boss/profile/)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { nextTabIndex, resolveTab } from "../public/assets/js/games/escape-boss/tabs.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const html = read("public/games/escape-boss/profile/index.html");
const page = read("public/assets/js/games/escape-boss/profile-page.js");
const css = read("public/assets/css/profile.css");
const dashboard = read("public/games/escape-boss/index.html");
const nav = read("public/assets/js/config/nav.js");

const TAB_IDS = ["player", "ranking", "achievements", "backup"];

describe("tabs.js: nextTabIndex", () => {
  it("→ ← は端でつながり、Home・End は両端へ移る", () => {
    assert.equal(nextTabIndex("ArrowRight", 0, 4), 1);
    assert.equal(nextTabIndex("ArrowRight", 3, 4), 0);
    assert.equal(nextTabIndex("ArrowLeft", 0, 4), 3);
    assert.equal(nextTabIndex("ArrowLeft", 2, 4), 1);
    assert.equal(nextTabIndex("Home", 2, 4), 0);
    assert.equal(nextTabIndex("End", 1, 4), 3);
  });

  it("関係のないキー・壊れた引数は null(Tab を奪わない)", () => {
    assert.equal(nextTabIndex("Tab", 0, 4), null);
    assert.equal(nextTabIndex("Enter", 0, 4), null);
    assert.equal(nextTabIndex("ArrowRight", 0, 0), null);
    assert.equal(nextTabIndex("ArrowRight", 1.5, 4), null);
    assert.equal(nextTabIndex("ArrowRight", "1", 4), null);
  });
});

describe("tabs.js: resolveTab", () => {
  it("一覧にある値はそのまま、ない値(書き換えられた ?tab=)は先頭", () => {
    assert.equal(resolveTab("backup", TAB_IDS), "backup");
    assert.equal(resolveTab("nope", TAB_IDS), "player");
    assert.equal(resolveTab(null, TAB_IDS), "player");
    assert.equal(resolveTab("__proto__", TAB_IDS), "player");
  });
});

describe("プレイヤー・記録のページの HTML", () => {
  it("noindex で、タブ 4 つとパネル 4 つが、対応している", () => {
    assert.match(html, /<meta name="robots" content="noindex" \/>/);
    for (const id of TAB_IDS) {
      assert.ok(html.includes(`data-tab="${id}"`), `tab ${id}`);
      assert.ok(html.includes(`data-panel="${id}"`), `panel ${id}`);
      assert.ok(html.includes(`aria-controls="panel-${id}"`), `controls ${id}`);
      assert.ok(html.includes(`aria-labelledby="tab-${id}"`), `labelledby ${id}`);
    }
    assert.match(html, /role="tablist"/);
  });

  it("最初に見えるのはプレイヤーのタブだけ(roving tabindex)", () => {
    const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((m) => m[0]);
    assert.equal(tabs.length, 4);
    const selected = tabs.filter((tag) => /aria-selected="true"/.test(tag));
    assert.equal(selected.length, 1);
    assert.match(selected[0], /data-tab="player"/);
    for (const tag of tabs.filter((t) => !/data-tab="player"/.test(t))) {
      assert.match(tag, /tabindex="-1"/);
    }
  });

  it("player 以外のパネルは、最初は hidden", () => {
    for (const id of TAB_IDS.slice(1)) {
      const start = html.indexOf(`data-panel="${id}"`);
      const tag = html.slice(html.lastIndexOf("<section", start), html.indexOf(">", start));
      assert.match(tag, /\bhidden\b/, id);
    }
  });

  it("ニックネーム(12文字まで)・称号・ランキング・実績・書き出しの部品がそろっている", () => {
    for (const hook of [
      "data-nickname",
      "data-title-select",
      "data-ranking-role",
      "data-ranking-difficulty",
      "data-online-ranking-role",
      "data-online-ranking-difficulty",
      "data-achievement-list",
      "data-backup-export",
      "data-backup-import",
    ]) {
      assert.ok(html.includes(hook), hook);
    }
    assert.match(html, /maxlength="12"/);
  });

  it("共通の main.js(ヘッダー・フッター・モーダル)を読み込む", () => {
    assert.ok(html.includes('src="/assets/js/main.js"'));
    assert.ok(html.includes('src="/assets/js/games/escape-boss/profile-page.js"'));
  });

  it("page.js が探す data 属性は、すべて HTML にある", () => {
    const hooks = new Set([...page.matchAll(/\[(data-[a-z-]+)(?:=[^\]]*)?\]/g)].map((m) => m[1]));
    assert.ok(hooks.size > 10);
    for (const hook of hooks) {
      assert.ok(html.includes(hook), hook);
    }
  });
});

describe("プレイヤー・記録のページのスクリプト", () => {
  it("表示は el()・textContent だけ(innerHTML を使わない)", () => {
    assert.ok(!/innerHTML|insertAdjacentHTML/.test(page));
  });

  it("タブは矢印キー・Home・End で動き、選んだタブだけ tabIndex 0 になる", () => {
    assert.match(page, /nextTabIndex\(/);
    assert.match(page, /aria-selected/);
    assert.match(page, /tabIndex/);
  });

  it("?tab= を読んで、選んだタブをアドレスに反映する(共有・ブックマークできる)", () => {
    assert.match(page, /resolveTab\(/);
    assert.match(page, /replaceState/);
  });

  it("オンラインランキングは、ランキングのタブを初めて開いたときに読む", () => {
    assert.match(page, /loadOnlineRanking/);
    assert.match(page, /fetchOnlineRanking/);
  });
});

describe("ダッシュボード・ナビとの関係", () => {
  it("ダッシュボードには、移したものの欄がなく、新しいページへのリンクがある", () => {
    for (const hook of [
      "data-profile",
      "data-nickname",
      "data-backup-export",
      "data-ranking-table",
      "data-online-ranking-table",
      "data-achievement-list",
    ]) {
      assert.ok(!dashboard.includes(hook), `ダッシュボードに ${hook} が残っている`);
    }
    assert.ok(dashboard.includes("/games/escape-boss/profile/"));
  });

  it("ナビ(ゲームの子)に「プレイヤー・記録」がある", () => {
    assert.ok(nav.includes("/games/escape-boss/profile/"));
    assert.ok(nav.includes("プレイヤー・記録"));
  });
});

describe("profile.css", () => {
  it("色はトークンだけ・選択中のタブは、色以外(太字・下線)でも示す", () => {
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), "色の直書きがない");
    assert.match(css, /aria-selected="true"[^}]*font-weight/);
    assert.match(css, /aria-selected="true"[^}]*text-decoration/);
  });

  it("タブのタップ領域は --tap-size・パネルの列は minmax(0, 1fr)・hidden で隠れる", () => {
    assert.match(css, /min-height: var\(--tap-size\)/);
    assert.match(css, /minmax\(0, 1fr\)/);
    assert.match(css, /\.profile-panel\[hidden\]\s*\{\s*display: none/);
  });
});
