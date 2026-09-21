// 用語の一覧の 1 件(review-item.js)のテスト(Phase 14 PR 2)。
// 関連する語・「くわしく」(難語の詳細説明・学習ポイント)を、語録に、あるときだけ出す。
// テストには、DOM がないので、要素を組み立てる最小の代用品(document.createElement)を使う。
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it, before } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.attrs = {};
    this.children = [];
  }
  setAttribute(name, value) {
    this.attrs[name] = value;
  }
  append(...items) {
    for (const item of items) this.children.push(typeof item === "string" ? { text: item } : item);
  }
}

// 木を、順に歩く(文字のノードは、{ text })
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
const byClass = (node, name) => find(node, (item) => item.attrs.class === name);

let reviewItem;
let extraOf;
before(async () => {
  globalThis.document = { createElement: (tag) => new FakeNode(tag) };
  ({ reviewItem, extraOf } = await import("../public/assets/js/games/escape-boss/review-item.js"));
});

const base = { id: "a-001", japanese: "語", reading: "ご", explanation: "短い説明。" };

describe("追加の内容の取り出し(extraOf)", () => {
  it("関連する語・詳細説明・学習ポイントを取り出す。ない語は、空", () => {
    assert.deepEqual(extraOf(base), { related: [], detail: "", points: [] });
    assert.deepEqual(
      extraOf({
        ...base,
        related_terms: ["甲", "乙"],
        detail: "詳しい説明。",
        learning_points: ["点 1", "点 2"],
      }),
      { related: ["甲", "乙"], detail: "詳しい説明。", points: ["点 1", "点 2"] },
    );
  });

  it("文字列でないもの・空の文字列は、捨てる。語録が壊れていても、落ちない", () => {
    assert.deepEqual(
      extraOf({
        ...base,
        related_terms: ["甲", "", "  ", null, 5, {}, "乙"],
        detail: 5,
        learning_points: "文字列",
      }),
      { related: ["甲", "乙"], detail: "", points: [] },
    );
    for (const word of [undefined, null, {}, { detail: "  " }, { related_terms: null }]) {
      assert.deepEqual(extraOf(word), { related: [], detail: "", points: [] });
    }
  });
});

describe("1 件の描画(reviewItem)", () => {
  it("説明だけの語: 語・読み・説明。関連する語・くわしく は、出さない", () => {
    const item = reviewItem({ word: base });
    assert.equal(item.tag, "li");
    assert.equal(textOf(byClass(item, "review-item__term")), "語(ご)");
    assert.equal(textOf(byClass(item, "review-item__text")), "短い説明。");
    assert.equal(byClass(item, "review-item__related"), undefined);
    assert.equal(
      find(item, (node) => node.tag === "details"),
      undefined,
    );
  });

  it("職種・ミスの回数があれば、バッジで出す", () => {
    const item = reviewItem({ word: base, misses: 3, jobName: "エンジニア" });
    const badges = [...walk(item)].filter((node) => node.attrs?.class?.startsWith("badge"));
    assert.deepEqual(badges.map(textOf), ["エンジニア", "ミス 3回"]);
  });

  it("関連する語だけがある語: 説明の下に、関連する語を出す。くわしく は、出さない", () => {
    const item = reviewItem({ word: { ...base, related_terms: ["甲", "乙"] } });
    assert.equal(textOf(byClass(item, "review-item__related")), "関連する語: 甲、乙");
    assert.equal(
      find(item, (node) => node.tag === "details"),
      undefined,
    );
    // 説明の後ろに、並ぶ
    const order = item.children.map((child) => child.attrs?.class);
    assert.ok(order.indexOf("review-item__text") < order.indexOf("review-item__related"));
  });

  it("詳細説明のある語: 「くわしく」(details の summary)の中に、詳細説明を出す", () => {
    const item = reviewItem({ word: { ...base, detail: "詳しい説明です。" } });
    const details = find(item, (node) => node.tag === "details");
    assert.ok(details);
    assert.equal(details.attrs.class, "review-item__more");
    assert.equal(textOf(find(details, (node) => node.tag === "summary")), "くわしく");
    assert.equal(textOf(byClass(details, "review-item__detail")), "詳しい説明です。");
    assert.equal(byClass(details, "review-item__points"), undefined);
    // 短い説明は、開かなくても、見える(details の外)
    assert.equal(textOf(byClass(item, "review-item__text")), "短い説明。");
    assert.ok(![...walk(details)].includes(byClass(item, "review-item__text")));
  });

  it("学習ポイントのある語: 「学習のポイント」の一覧を、くわしく の中に出す", () => {
    const item = reviewItem({ word: { ...base, learning_points: ["点 1", "点 2", "点 3"] } });
    const details = find(item, (node) => node.tag === "details");
    assert.ok(details);
    assert.equal(byClass(details, "review-item__detail"), undefined);
    assert.equal(textOf(byClass(details, "review-item__points-title")), "学習のポイント");
    const points = [...walk(details)].filter((node) => node.tag === "li").map(textOf);
    assert.deepEqual(points, ["点 1", "点 2", "点 3"]);
  });

  it("全部ある語: 詳細説明・学習ポイント・関連する語が、そろう", () => {
    const item = reviewItem({
      word: {
        ...base,
        related_terms: ["甲"],
        detail: "詳しい説明です。",
        learning_points: ["点 1"],
      },
      misses: 1,
    });
    assert.ok(byClass(item, "review-item__related"));
    assert.ok(byClass(item, "review-item__detail"));
    assert.ok(byClass(item, "review-item__points"));
    assert.equal([...walk(item)].filter((node) => node.tag === "details").length, 1);
  });

  it("語録の文字列は、HTML として解釈しない(文字のノードとして入れる)", () => {
    const evil = "<img src=x onerror=window.__xss=1><script>window.__xss=2</script>";
    const item = reviewItem({
      word: {
        ...base,
        japanese: evil,
        explanation: evil,
        related_terms: [evil],
        detail: evil,
        learning_points: [evil],
      },
    });
    const texts = [...walk(item)].filter((node) => "text" in node).map((node) => node.text);
    assert.ok(texts.some((value) => value.includes("<img")));
    // タグの要素は、作られていない(要素の名前は、決まった集合だけ)
    const tags = new Set([...walk(item)].filter((node) => node.tag).map((node) => node.tag));
    assert.deepEqual([...tags].sort(), ["details", "div", "li", "p", "span", "summary", "ul"]);
    assert.equal(globalThis.__xss, undefined);
  });

  it("実際の語録の、すべての語を、描ける(落ちない)。詳細説明のある語は、くわしく が出る", () => {
    let detailed = 0;
    for (const file of readdirSync(`${root}public/data/vocabulary/`)) {
      const data = JSON.parse(readFileSync(`${root}public/data/vocabulary/${file}`, "utf8"));
      for (const word of data.items) {
        const item = reviewItem({ word });
        const hasDetails = Boolean(find(item, (node) => node.tag === "details"));
        assert.equal(hasDetails, Boolean(word.detail) || word.learning_points.length > 0, word.id);
        if (word.detail) detailed += 1;
        assert.equal(Boolean(byClass(item, "review-item__related")), word.related_terms.length > 0);
      }
    }
    assert.equal(detailed, 6);
  });
});

describe("ソース", () => {
  const source = readFileSync(
    `${root}public/assets/js/games/escape-boss/review-item.js`,
    "utf8",
  ).replace(/\/\/.*$/gm, "");

  it("HTML として解釈する書き方を、していない。DOM は、el() だけで組み立てる", () => {
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(source));
    assert.ok(!/document\./.test(source));
  });
});
