import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { AD_PLACEMENTS } from "../public/assets/js/components/ad-slot.js";
import { footerLinks } from "../public/assets/js/config/nav.js";

const read = (path) => readFileSync(new URL(`../public/${path}`, import.meta.url), "utf8");
const page = read("ads-policy/index.html");

describe("広告・収益化について(/ads-policy/)", () => {
  it("フッターからリンクされ、プライバシーポリシーからも案内される", () => {
    assert.ok(footerLinks.some((link) => link.href === "/ads-policy/"));
    assert.match(read("privacy/index.html"), /href="\/ads-policy\/"/);
  });

  it("現在は広告・アフィリエイトを掲載していないと書き、プライバシーポリシーと食い違わない", () => {
    assert.match(page, /現在、広告もアフィリエイトも掲載していません/);
    assert.match(read("privacy/index.html"), /現在、広告を掲載していません/);
  });

  it("広告事業者などの外部スクリプト・画像を読み込まない", () => {
    assert.doesNotMatch(page, /<script[^>]+src="https?:/);
    assert.doesNotMatch(page, /googletagmanager|adsbygoogle|doubleclick/);
  });

  it("載せてよい場所・載せない場所が、広告枠の配置のルール(ad-slot.js)と合っている", () => {
    assert.deepEqual(AD_PLACEMENTS, ["page", "article", "game-result"]);
    assert.match(page, /ゲームの外のページ/);
    assert.match(page, /記事/);
    assert.match(page, /終了.結果.画面/);
    assert.match(page, /プレイ中の画面/);
  });

  it("必要な表示(広告・PR の文字表示・報酬の明記・外部リンクの注意)を定めている", () => {
    assert.match(page, /「広告」または「PR」/);
    assert.match(page, /報酬を受け取ることがある/);
    assert.match(page, /外部のサイトへ移動/);
  });

  it("検索結果に出るページとして、canonical と description がある(noindex ではない)", () => {
    assert.match(page, /rel="canonical" href="https:\/\/nolito\.pages\.dev\/ads-policy\/"/);
    assert.match(page, /<meta\s+name="description"/);
    assert.doesNotMatch(page, /noindex/);
  });
});
