import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { AD_PLACEMENTS, initAdSlots } from "../public/assets/js/components/ad-slot.js";
import { adsConfig } from "../public/assets/js/config/ads.js";
import { analyticsConfig } from "../public/assets/js/config/analytics.js";
import { footerLinks, mainNav } from "../public/assets/js/config/nav.js";
import { MEASUREMENT_ID_PATTERN } from "../public/assets/js/components/consent-core.js";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const functionsDir = fileURLToPath(new URL("../functions/", import.meta.url));
const read = (path) => readFileSync(join(publicDir, path), "utf8");
const readJson = (path) => JSON.parse(read(path));

function htmlFiles(dir = publicDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

// "/games/" → public/games/index.html、"/favicon.svg" → public/favicon.svg
const pageExists = (href) => {
  const path = href.split("#")[0].split("?")[0];
  if (path === "") return true;
  const target = path.endsWith("/") ? `${path}index.html` : path;
  return existsSync(join(publicDir, target.slice(1)));
};

describe("サイトの設定の整合", () => {
  const site = readJson("data/site.json");

  it("計測の対象ホストに、サイトの URL のホストが含まれる(独自ドメインにしたら、両方を変える)", () => {
    assert.ok(analyticsConfig.hosts.includes(new URL(site.url).hostname));
  });

  it("測定 ID は、未設定(空)か、正しい形式のどちらか", () => {
    assert.ok(
      analyticsConfig.measurementId === "" ||
        MEASUREMENT_ID_PATTERN.test(analyticsConfig.measurementId),
    );
  });

  it("プライバシーポリシーの版が、設定の版と一致している(ポリシーを変えたら両方の版を上げる)", () => {
    const match = /data-policy-version="(\d+)"/.exec(read("privacy/index.html"));
    assert.equal(Number(match?.[1]), analyticsConfig.policyVersion);
  });

  it("プライバシーポリシーに、計測の説明(同意・Google・撤回の方法・Cookie)がある", () => {
    const text = read("privacy/index.html");
    for (const word of [
      "Google アナリティクス",
      "同意",
      "アクセス解析の設定",
      "オプトアウト",
      "Cookie",
      "LocalStorage",
    ]) {
      assert.ok(text.includes(word), word);
    }
  });

  it("広告は、Phase 5 では無効(広告事業者の導入は Phase 29)", () => {
    assert.equal(adsConfig.enabled, false);
  });
});

// Cloudflare Pages Functions のルート: "/auth/google/login" → functions/auth/google/login.js
const functionRouteExists = (href) => {
  const path = href.split("#")[0].split("?")[0];
  return !path.endsWith("/") && existsSync(join(functionsDir, `${path.slice(1)}.js`));
};

describe("ナビ・フッターのリンク", () => {
  it("有効なナビ項目とフッターのリンクは、実在するページを指す(404 を作らない)", () => {
    for (const item of mainNav.filter((i) => i.available !== false))
      assert.ok(pageExists(item.href), item.href);
    for (const link of footerLinks) assert.ok(pageExists(link.href), link.href);
  });

  it("記事のナビが有効", () => {
    assert.equal(mainNav.find((i) => i.label === "記事")?.available, undefined);
  });
});

describe("すべてのページのサイト内リンク", () => {
  it("リンク先が、実在するページ・ファイルである", () => {
    const broken = [];
    for (const file of htmlFiles()) {
      const html = readFileSync(file, "utf8");
      for (const [, href] of html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)) {
        if (href.startsWith("//")) continue;
        if (!pageExists(href) && !functionRouteExists(href))
          broken.push(`${relative(publicDir, file)} → ${href}`);
      }
    }
    assert.deepEqual(broken, []);
  });
});

describe("広告の枠の配置ルール", () => {
  it("許可されている配置は、ゲームの外のページ・記事・終了画面だけ", () => {
    assert.deepEqual([...AD_PLACEMENTS].sort(), ["article", "game-result", "page"]);
  });

  it("すべてのページの広告の枠は、許可された配置で、非表示(hidden)になっている", () => {
    let count = 0;
    for (const file of htmlFiles()) {
      const html = readFileSync(file, "utf8");
      for (const [tag, placement] of html
        .matchAll(/<[^>]*data-ad-slot="([^"]*)"[^>]*>/g)
        .map((m) => [m[0], m[1]])) {
        count += 1;
        assert.ok(AD_PLACEMENTS.includes(placement), `${relative(publicDir, file)}: ${placement}`);
        assert.match(tag, /\bhidden\b/, `${relative(publicDir, file)}: hidden がありません`);
      }
    }
    assert.ok(count >= 3, "記事・一覧・終了画面に枠がある");
  });

  it("ゲームのプレイ画面(data-view=play)の中に、広告の枠はない", () => {
    const html = read("games/escape-boss/index.html");
    const start = html.indexOf('data-view="play"');
    const end = html.indexOf('data-view="result"');
    assert.ok(start > 0 && end > start);
    assert.doesNotMatch(html.slice(start, end), /data-ad-slot/);
    const dashboardEnd = html.indexOf('data-view="play"');
    assert.doesNotMatch(
      html.slice(0, dashboardEnd),
      /data-ad-slot/,
      "ダッシュボードにも置かない(Phase 5)",
    );
  });

  it("終了(結果)画面の枠は、結果の画面の中にある", () => {
    const html = read("games/escape-boss/index.html");
    const result = html.slice(html.indexOf('data-view="result"'));
    assert.match(result, /data-ad-slot="game-result"/);
  });

  it("記事のページと一覧に、枠がある", () => {
    assert.match(read("articles/index.html"), /data-ad-slot="page"/);
    assert.match(read("articles/escape-boss-guide/index.html"), /data-ad-slot="article"/);
  });
});

// initAdSlots が使う DOM の代わり
const slot = (placement, { inPlay = false } = {}) => ({
  dataset: { adSlot: placement },
  hidden: true,
  removed: false,
  closest(selector) {
    return inPlay && selector === '[data-view="play"]' ? {} : null;
  },
  remove() {
    this.removed = true;
  },
});
const root = (slots) => ({ querySelectorAll: () => slots });

describe("広告の枠の初期化", () => {
  it("無効なあいだは、枠は非表示のまま(何も描かない)", () => {
    const slots = [slot("article"), slot("page"), slot("game-result")];
    assert.equal(
      initAdSlots(root(slots), { enabled: false, render: () => assert.fail("描いてはいけない") }),
      0,
    );
    assert.ok(slots.every((s) => s.hidden && !s.removed));
  });

  it("有効でも、広告を描く処理がなければ表示しない", () => {
    const slots = [slot("article")];
    assert.equal(initAdSlots(root(slots), { enabled: true }), 0);
    assert.equal(slots[0].hidden, true);
  });

  it("有効で、描く処理があれば、許可された枠だけを表示して描く", () => {
    const slots = [slot("article"), slot("game-result")];
    const drawn = [];
    assert.equal(initAdSlots(root(slots), { enabled: true, render: (s, p) => drawn.push(p) }), 2);
    assert.deepEqual(drawn, ["article", "game-result"]);
    assert.ok(slots.every((s) => !s.hidden));
  });

  it("許可されていない配置・プレイ中の画面の枠は、取り除く(有効でも表示しない)", () => {
    const slots = [slot("sidebar"), slot("article", { inPlay: true }), slot("page")];
    const drawn = [];
    initAdSlots(root(slots), { enabled: true, render: (s, p) => drawn.push(p) });
    assert.equal(slots[0].removed, true);
    assert.equal(slots[1].removed, true);
    assert.equal(slots[2].removed, false);
    assert.deepEqual(drawn, ["page"]);
  });
});
