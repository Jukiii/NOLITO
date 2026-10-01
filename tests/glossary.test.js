// 用語一覧ページ(/games/escape-boss/glossary/。Issue #156)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { mainNav } from "../public/assets/js/config/nav.js";
import { countWords, glossaryGroups } from "../public/assets/js/games/escape-boss/glossary.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const json = (path) => JSON.parse(read(path));

const vocab = (jobId, jobName, items) => ({ job_id: jobId, job_name: jobName, items });
const word = (id, japanese, overrides = {}) => ({
  id,
  japanese,
  reading: "よみ",
  romaji: ["yomi"],
  category: "カテゴリ",
  explanation: "説明です。",
  ...overrides,
});

describe("glossaryGroups(職種ごとの一覧・絞り込み)", () => {
  const vocabularies = [
    vocab("engineer", "エンジニア", [
      word("e-1", "bug", {
        reading: "ばぐ",
        romaji: ["bug"],
        typing: "bug",
        related_terms: ["debug"],
      }),
      word("e-2", "デバッグ", { explanation: "不具合を直すこと。" }),
    ]),
    vocab("sales", "営業", [word("s-1", "顧客", { explanation: "商品を買う人。" })]),
  ];

  it("絞り込みなしなら、職種ごとに全件を返す(入力の順)", () => {
    const groups = glossaryGroups(vocabularies);
    assert.deepEqual(
      groups.map((g) => [g.jobId, g.jobName, g.total, g.words.length]),
      [
        ["engineer", "エンジニア", 2, 2],
        ["sales", "営業", 1, 1],
      ],
    );
    assert.equal(countWords(groups), 3);
  });

  it("キーワードは、語・読み・ローマ字・英語のつづり・カテゴリ・説明・関連語にヒットする(大文字小文字を区別しない)", () => {
    const hit = (query) => countWords(glossaryGroups(vocabularies, { query }));
    assert.equal(hit("顧客"), 1);
    assert.equal(hit("ばぐ"), 1);
    assert.equal(hit("BUG"), 1);
    assert.equal(hit("直す"), 1);
    assert.equal(hit("debug"), 1);
    assert.equal(hit("カテゴリ"), 3);
    assert.equal(hit("存在しない語"), 0);
  });

  it("空白で区切ると、すべてを含むものだけ(かつ条件)", () => {
    assert.equal(countWords(glossaryGroups(vocabularies, { query: "不具合 デバッグ" })), 1);
    assert.equal(countWords(glossaryGroups(vocabularies, { query: "不具合 顧客" })), 0);
  });

  it("jobId で、その職種だけになる。存在しない職種は、空", () => {
    assert.deepEqual(
      glossaryGroups(vocabularies, { jobId: "sales" }).map((g) => g.jobId),
      ["sales"],
    );
    assert.deepEqual(glossaryGroups(vocabularies, { jobId: "none" }), []);
  });

  it("0 件の職種も、total つきで返す(呼び出し側が、表示するかを決める)", () => {
    const [engineer] = glossaryGroups(vocabularies, { query: "顧客" });
    assert.equal(engineer.total, 2);
    assert.equal(engineer.words.length, 0);
  });

  it("壊れた職種・語は、飛ばして落ちない。入力は書き換えない", () => {
    const broken = [
      null,
      {},
      vocab("x", "X", "not-array"),
      vocab("y", "Y", [null, { id: "" }, word("y-1", "語")]),
    ];
    const before = JSON.stringify(broken);
    const groups = glossaryGroups(broken, { query: "語" });
    assert.deepEqual(
      groups.map((g) => [g.jobId, g.words.length]),
      [["y", 1]],
    );
    assert.equal(JSON.stringify(broken), before);
    assert.deepEqual(glossaryGroups(undefined), []);
  });
});

describe("実際の語録", () => {
  const jobs = json("public/data/jobs.json");
  const vocabularies = jobs.map((job) => json(`public/data/vocabulary/${job.id}.json`));

  it("全職種・全語(公開済みのすべて)が、一覧に出る", () => {
    const groups = glossaryGroups(vocabularies);
    assert.equal(groups.length, jobs.length);
    const all = vocabularies.reduce((sum, v) => sum + v.items.length, 0);
    assert.equal(countWords(groups), all);
    assert.ok(all >= 203);
  });

  it("どの語も、自分の日本語の表記で、絞り込める", () => {
    for (const vocabulary of vocabularies) {
      for (const item of vocabulary.items) {
        const [group] = glossaryGroups([vocabulary], { query: item.japanese });
        assert.ok(
          group.words.some((w) => w.id === item.id),
          item.id,
        );
      }
    }
  });
});

describe("ページの静的な性質", () => {
  const html = read("public/games/escape-boss/glossary/index.html");
  const pageJs = read("public/assets/js/games/escape-boss/glossary-page.js");
  const logicJs = read("public/assets/js/games/escape-boss/glossary.js");
  const css = read("public/assets/css/glossary.css");

  it("ゲームのメニューから、用語一覧へ行ける", () => {
    const game = mainNav.find((item) => item.href === "/games/");
    assert.ok(game.children.some((c) => c.href === "/games/escape-boss/glossary/"));
  });

  it("題名・説明・canonical がある。検索に載せてよいページ(noindex なし)", () => {
    assert.match(html, /<title>用語一覧 \| 上司から逃げろ \| NOLITO<\/title>/);
    assert.match(
      html,
      /rel="canonical" href="https:\/\/nolito\.pages\.dev\/games\/escape-boss\/glossary\/"/,
    );
    assert.ok(!html.includes('name="robots"'));
  });

  it("フォームは role=search。キーワード・職種の欄に、ラベルがある。JavaScript なしの案内もある", () => {
    assert.match(html, /role="search"/);
    assert.match(html, /<label for="glossary-input">/);
    assert.match(html, /<label for="glossary-job">/);
    assert.match(html, /<noscript>/);
  });

  it("page.js が探す目印は、HTML にある", () => {
    for (const hook of [
      "data-glossary",
      "data-glossary-form",
      "data-glossary-input",
      "data-glossary-job",
      "data-glossary-status",
      "data-glossary-jump",
      "data-glossary-list",
    ]) {
      assert.ok(html.includes(hook), `HTML: ${hook}`);
      assert.ok(pageJs.includes(hook), `page.js: ${hook}`);
    }
  });

  it("HTML として解釈する書き方をしない(表示は、textContent だけ)。ブラウザに記録を置かない。外部へ通信しない", () => {
    const all = `${pageJs}\n${logicJs}`;
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(all));
    assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(all));
    assert.ok(!/https?:\/\//.test(all));
  });

  it("絞り込みの計算は、DOM に触れない純粋な関数のまま", () => {
    assert.ok(!/document\.|window\.|querySelector|location\./.test(logicJs));
  });

  it("CSS は、色をトークンで指定する。列は minmax(0, 1fr)(スマホで横にはみ出さない)", () => {
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(css));
    assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/);
  });
});
