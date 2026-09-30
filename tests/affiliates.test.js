// アフィリエイト・広告のリンク情報と、その表示の部品(Phase 29 PR 2)のテスト。
// テストには DOM がないので、要素を組み立てる最小の代用品(document.createElement)を使う。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  AFFILIATE_DATA_VERSION,
  AFFILIATE_KINDS,
  MAX_LINKS_PER_SLOT,
  linksForPlacement,
  validateAffiliateLink,
  validateAffiliates,
} from "../public/assets/js/affiliates/schema.js";
import { AD_PLACEMENTS } from "../public/assets/js/components/ad-slot.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(root + path, "utf8");

class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.attrs = {};
    this.children = [];
    this.hidden = false;
  }
  setAttribute(name, value) {
    this.attrs[name] = value;
  }
  append(...items) {
    for (const item of items) this.children.push(typeof item === "string" ? { text: item } : item);
  }
  replaceChildren(...items) {
    this.children = [];
    this.append(...items);
  }
}
function* walk(node) {
  yield node;
  for (const child of node.children ?? []) yield* walk(child);
}
const textOf = (node) =>
  [...walk(node)]
    .filter((item) => "text" in item)
    .map((item) => item.text)
    .join("");
const find = (node, predicate) => [...walk(node)].find((item) => item.tag && predicate(item));
const ids = (links) => links.map((item) => item.id);

const link = (over = {}) => ({
  id: "sample-link",
  kind: "affiliate",
  title: "サンプルのサービス",
  description: "説明の文です。",
  advertiser: "サンプル社",
  url: "https://example.com/item?ref=nolito",
  placements: ["article"],
  ...over,
});
const file = (links) => ({ version: AFFILIATE_DATA_VERSION, links });

describe("リンク情報の検証", () => {
  it("正しいリンクは、問題なし", () => {
    assert.deepEqual(validateAffiliateLink(link()), []);
    assert.deepEqual(
      validateAffiliateLink(link({ kind: "ad", placements: [...AD_PLACEMENTS] })),
      [],
    );
  });

  it("表示の文字は kind から決まる(自由に書けない)", () => {
    assert.deepEqual(AFFILIATE_KINDS, { affiliate: "PR", ad: "広告" });
    assert.notDeepEqual(validateAffiliateLink(link({ kind: "sponsor" })), []);
    assert.notDeepEqual(validateAffiliateLink(link({ label: "おすすめ" })), []);
  });

  it("url は https だけ(サイト内のパス・http・javascript・data は不可)", () => {
    const urls = ["/about/", "http://example.com/", "javascript:alert(1)", "data:text/html,x", ""];
    for (const url of [...urls, "https://"]) {
      assert.notDeepEqual(validateAffiliateLink(link({ url })), [], url);
    }
  });

  it("placements は、広告枠の配置のルールにあるものだけ(プレイ中は不可)", () => {
    const bad = [[], ["play"], ["article", "article"], "article", ["page", "game"]];
    for (const placements of bad) {
      assert.notDeepEqual(
        validateAffiliateLink(link({ placements })),
        [],
        JSON.stringify(placements),
      );
    }
  });

  it("文字の項目は、長さ・制御文字・見えない文字・< > を検査する", () => {
    const bad = [
      { title: "" },
      { title: "あ".repeat(61) },
      { description: "あ".repeat(121) },
      { advertiser: "あ".repeat(41) },
      { title: "改行\nあり" },
      { title: "向き" + String.fromCharCode(0x202e) + "変更" },
      { description: "<script>x</script>" },
    ];
    for (const over of bad) {
      assert.notDeepEqual(validateAffiliateLink(link(over)), [], JSON.stringify(over));
    }
  });

  it("id の形・知らない項目・オブジェクトでないものも、不可", () => {
    assert.notDeepEqual(validateAffiliateLink(link({ id: "Bad_Id" })), []);
    assert.notDeepEqual(validateAffiliateLink(link({ extra: 1 })), []);
    assert.notDeepEqual(validateAffiliateLink(null), []);
  });

  it("ファイル全体: 形・版・id の重複を検査する", () => {
    assert.deepEqual(validateAffiliates(file([])), []);
    assert.notDeepEqual(validateAffiliates({ version: 99, links: [] }), []);
    assert.notDeepEqual(validateAffiliates({ version: 1 }), []);
    assert.notDeepEqual(validateAffiliates(file([link(), link()])), []);
  });
});

describe("表示するリンクの選び方", () => {
  it("その枠のものだけを選ぶ", () => {
    const data = file([
      link({ id: "a", placements: ["article"] }),
      link({ id: "b", placements: ["page", "article"] }),
      link({ id: "c", placements: ["game-result"] }),
    ]);
    assert.deepEqual(ids(linksForPlacement(data, "article")), ["a", "b"]);
    assert.deepEqual(ids(linksForPlacement(data, "page")), ["b"]);
    assert.deepEqual(ids(linksForPlacement(data, "game-result")), ["c"]);
  });

  it("不正な項目・重複は外して、ほかは表示する", () => {
    const data = file([
      link({ id: "ok" }),
      link({ id: "bad", url: "http://example.com/" }),
      link({ id: "ok" }),
    ]);
    assert.deepEqual(ids(linksForPlacement(data, "article")), ["ok"]);
  });

  it("プレイ中など許可されていない枠・不正なファイルでは、何も返さない", () => {
    assert.deepEqual(linksForPlacement(file([link()]), "play"), []);
    assert.deepEqual(linksForPlacement({ version: 2, links: [link()] }, "article"), []);
    assert.deepEqual(linksForPlacement(null, "article"), []);
  });

  it(`1つの枠に、最大 ${MAX_LINKS_PER_SLOT} 件`, () => {
    const links = Array.from({ length: 6 }, (_, i) => link({ id: `l-${i}` }));
    assert.equal(linksForPlacement(file(links), "article").length, MAX_LINKS_PER_SLOT);
  });
});

describe("表示の部品(affiliate-list.js)", () => {
  let affiliateCard;
  let affiliateNodes;
  let renderAffiliateSlot;
  before(async () => {
    globalThis.document = { createElement: (tag) => new FakeNode(tag) };
    ({ affiliateCard, affiliateNodes, renderAffiliateSlot } =
      await import("../public/assets/js/components/affiliate-list.js"));
  });
  const badgeOf = (card) => find(card, (n) => n.attrs.class?.includes("affiliate-card__badge"));

  it("カードに、「PR」「広告」の文字・提供元・外部サイトの注意がある", () => {
    const pr = affiliateCard(link());
    assert.equal(textOf(badgeOf(pr)), "PR");
    assert.match(textOf(pr), /提供: サンプル社/);
    assert.match(textOf(pr), /外部サイトへ移動します/);
    assert.equal(textOf(badgeOf(affiliateCard(link({ kind: "ad" })))), "広告");
  });

  it("リンクは、sponsored・noopener・noreferrer つき。移動先は https だけ", () => {
    const anchor = find(affiliateCard(link()), (n) => n.tag === "a");
    assert.equal(anchor.attrs.href, "https://example.com/item?ref=nolito");
    for (const word of ["sponsored", "noopener", "noreferrer"]) {
      assert.match(anchor.attrs.rel, new RegExp(word));
    }
    assert.equal(anchor.attrs.target, undefined);
  });

  it("データの文字は、HTML として解釈されない(文字として入る)", () => {
    const card = affiliateCard(link({ title: "A&amp;B" }));
    assert.equal(textOf(find(card, (n) => n.tag === "a")), "A&amp;B");
    assert.ok(![...walk(card)].some((n) => n.tag === "script"));
  });

  it("リンクがあるときだけ、報酬の説明と /ads-policy/ へのリンクが付く", () => {
    assert.deepEqual(affiliateNodes(file([]), "article"), []);
    const last = affiliateNodes(file([link()]), "article").at(-1);
    assert.equal(last.attrs.class, "affiliate-disclosure");
    assert.match(textOf(last), /報酬が入ることがあります/);
    assert.equal(find(last, (n) => n.tag === "a").attrs.href, "/ads-policy/");
  });

  it("枠の描画: リンクがあれば枠に入れ、なければ非表示に戻す", async () => {
    const slot = new FakeNode("aside");
    const fetchJson = async () => file([link()]);
    assert.equal(await renderAffiliateSlot(slot, "article", { fetchJson }), 1);
    assert.equal(slot.hidden, false);
    assert.ok(find(slot, (n) => n.attrs.class === "affiliate-card"));

    const empty = new FakeNode("aside");
    const none = async () => file([]);
    assert.equal(await renderAffiliateSlot(empty, "article", { fetchJson: none }), 0);
    assert.equal(empty.hidden, true);
  });

  it("読み込みに失敗しても、落ちず、枠は非表示に戻る", async () => {
    const slot = new FakeNode("aside");
    const fetchJson = async () => {
      throw new Error("network");
    };
    assert.equal(await renderAffiliateSlot(slot, "page", { fetchJson }), 0);
    assert.equal(slot.hidden, true);
  });
});

describe("実際のデータと、いまの方針の整合", () => {
  const data = JSON.parse(read("public/data/affiliates.json"));
  const adsConfig = read("public/assets/js/config/ads.js");

  it("public/data/affiliates.json は、検証を通る", () => {
    assert.deepEqual(validateAffiliates(data), []);
  });

  it("リンクを公開するときは、広告の設定を有効にし、/ads-policy/ の『掲載していない』を直す", () => {
    if (data.links.length === 0) {
      assert.match(adsConfig, /enabled:\s*false/);
      return;
    }
    const policy = read("public/ads-policy/index.html");
    assert.ok(!policy.includes("現在、広告もアフィリエイトも掲載していません"));
    assert.match(adsConfig, /enabled:\s*true/);
  });

  it("main.js は、広告枠に affiliate-list の描画を渡している", () => {
    const main = read("public/assets/js/main.js");
    assert.match(
      main,
      /initAdSlots\(document,\s*\{\s*\.\.\.adsConfig,\s*render:\s*renderAffiliateSlot/,
    );
  });

  it("styleguide に、見本がある", () => {
    const html = read("public/styleguide/index.html");
    assert.match(html, /affiliate-card/);
    assert.match(html, /affiliate-disclosure/);
  });
});
