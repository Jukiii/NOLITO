import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  codeSpan,
  escapeMarkdown,
  sheetModel,
  toMarkdown,
} from "../public/assets/js/tools/kii-michi/cheatsheet.js";
import {
  addApp,
  addOperation,
  addRoute,
  addStep,
  initialData,
  setOs,
} from "../public/assets/js/tools/kii-michi/model.js";

const counter = () => {
  let n = 0;
  return (prefix) => `${prefix}${++n}`;
};
const ok = (result) => {
  assert.equal(result.ok, true, result.message);
  return result.data;
};

// ブラウザ(新しいタブ・アドレスバー)・エディタ(コマンド)・操作のないアプリ・ルート1つ
function sample() {
  const id = counter();
  let data = initialData();
  data = ok(addApp(data, "ブラウザ", id));
  data = ok(addApp(data, "エディタ", id));
  data = ok(addApp(data, "空のアプリ", id));
  data = ok(
    addOperation(data, { appId: "a1", name: "新しいタブ", keysText: "Ctrl+T", note: "" }, id),
  );
  data = ok(
    addOperation(
      data,
      { appId: "a1", name: "アドレスバー", keysText: "Ctrl+L", note: "URL を入力" },
      id,
    ),
  );
  data = ok(
    addOperation(data, { appId: "a2", name: "コメント", keysText: "Ctrl+K Ctrl+C", note: "" }, id),
  );
  data = ok(addRoute(data, { name: "調べもの", note: "検索して、メモする" }, id));
  for (const op of ["o4", "o5", "o6"]) data = ok(addStep(data, "r7", op));
  return data;
}

describe("チートシートの内容", () => {
  it("ルートの手順は、アプリ名・操作名・キー(表記つき)・メモを持つ", () => {
    const model = sheetModel(sample());
    assert.deepEqual(model.routes, [
      {
        name: "調べもの",
        note: "検索して、メモする",
        steps: [
          { app: "ブラウザ", name: "新しいタブ", keys: "Ctrl+T", note: "" },
          { app: "ブラウザ", name: "アドレスバー", keys: "Ctrl+L", note: "URL を入力" },
          { app: "エディタ", name: "コメント", keys: "Ctrl+K → Ctrl+C", note: "" },
        ],
      },
    ]);
  });

  it("アプリ別の一覧は、操作のあるアプリだけを、登録順に載せる", () => {
    const model = sheetModel(sample());
    assert.deepEqual(
      model.apps.map((app) => app.name),
      ["ブラウザ", "エディタ"],
    );
    assert.deepEqual(
      model.apps[0].operations.map((o) => o.name),
      ["新しいタブ", "アドレスバー"],
    );
  });

  it("キーの表記は OS で変わる(Windows・Mac)", () => {
    const data = ok(setOs(sample(), "mac"));
    let withMeta = ok(addApp(data, "メモ"));
    withMeta = ok(
      addOperation(withMeta, {
        appId: withMeta.apps[3].id,
        name: "保存",
        keysText: "Cmd+S",
        note: "",
      }),
    );
    assert.equal(sheetModel(withMeta, { os: "mac" }).apps[2].operations[0].keys, "Command+S");
    assert.equal(sheetModel(withMeta, { os: "windows" }).apps[2].operations[0].keys, "Win+S");
  });

  it("載せるものを選べる(ルートだけ・一覧だけ)", () => {
    const data = sample();
    const routesOnly = sheetModel(data, { includeList: false });
    assert.equal(routesOnly.routes.length, 1);
    assert.deepEqual(routesOnly.apps, []);
    const listOnly = sheetModel(data, { includeRoutes: false });
    assert.deepEqual(listOnly.routes, []);
    assert.equal(listOnly.apps.length, 2);
  });

  it("何も登録していないときは、空", () => {
    const model = sheetModel(initialData());
    assert.deepEqual([model.routes, model.apps], [[], []]);
  });
});

describe("Markdown", () => {
  it("見出し・ルートの手順(番号つき)・アプリ別の表の形になる", () => {
    const markdown = toMarkdown(sheetModel(sample()), { date: "2026-09-20" });
    assert.equal(
      markdown,
      [
        "# キーみち チートシート",
        "",
        "作成日: 2026-09-20 / キーの表記: Windows",
        "",
        "## 操作ルート",
        "",
        "### 調べもの",
        "",
        "検索して、メモする",
        "",
        "1. ブラウザ: 新しいタブ — `Ctrl+T`",
        "2. ブラウザ: アドレスバー — `Ctrl+L`(URL を入力)",
        "3. エディタ: コメント — `Ctrl+K → Ctrl+C`",
        "",
        "## アプリ別のショートカット",
        "",
        "### ブラウザ",
        "",
        "| 操作 | キー | メモ |",
        "| --- | --- | --- |",
        "| 新しいタブ | `Ctrl+T` |  |",
        "| アドレスバー | `Ctrl+L` | URL を入力 |",
        "",
        "### エディタ",
        "",
        "| 操作 | キー | メモ |",
        "| --- | --- | --- |",
        "| コメント | `Ctrl+K → Ctrl+C` |  |",
        "",
      ].join("\n"),
    );
  });

  it("日付がなければ書かない。Mac の表記・載せない節は出さない", () => {
    const data = ok(setOs(sample(), "mac"));
    const markdown = toMarkdown(sheetModel(data, { os: "mac", includeList: false }));
    assert.ok(markdown.includes("キーの表記: macOS"));
    assert.ok(!markdown.includes("作成日"));
    assert.ok(!markdown.includes("アプリ別のショートカット"));
    assert.ok(markdown.includes("## 操作ルート"));
  });

  it("空のときは、案内の文を出す(見出しだけにしない)", () => {
    const markdown = toMarkdown(sheetModel(initialData()));
    assert.ok(markdown.includes("ルートは、まだありません。"));
    assert.ok(markdown.includes("登録された操作は、まだありません。"));
    const emptyRoute = toMarkdown(
      sheetModel(ok(addRoute(initialData(), { name: "空", note: "" }))),
    );
    assert.ok(emptyRoute.includes("手順は、まだありません。"));
  });

  it("末尾は改行1つ", () => {
    const markdown = toMarkdown(sheetModel(sample()));
    assert.ok(markdown.endsWith("|\n"));
    assert.ok(!markdown.endsWith("\n\n"));
  });

  it("名前・メモに含まれる Markdown・HTML の記法は、打ち消される", () => {
    const id = counter();
    let data = ok(addApp(initialData(), "<script>alert(1)</script>", id));
    data = ok(
      addOperation(
        data,
        {
          appId: "a1",
          name: "[リンク](javascript:alert(1)) *強調* _下線_",
          keysText: "Ctrl+A",
          note: "a | b\nc `code` <img src=x onerror=alert(1)>",
        },
        id,
      ),
    );
    data = ok(addRoute(data, { name: "# 見出し", note: "- 項目\n2. 番号" }, id));
    data = ok(addStep(data, "r3", "o2"));
    const markdown = toMarkdown(sheetModel(data));
    // 打ち消されていない < が、1つもない(\<script\> のように、必ず \ が前にある)
    assert.equal(/(?<!\\)</.test(markdown), false);
    assert.equal(/(?<!\\)>/.test(markdown), false);
    assert.ok(markdown.includes("\\<script\\>"));
    assert.ok(markdown.includes("\\[リンク\\]"));
    assert.ok(markdown.includes("\\*強調\\*"));
    assert.ok(markdown.includes("### \\# 見出し") === false);
    // 行頭でない「2.」は、リストにならないので、打ち消さない(行頭の「- 」だけ打ち消す)
    assert.ok(markdown.includes("\\- 項目 2. 番号"));
    // 表の行は、区切りの | が、ちょうど4つ(操作・キー・メモの3列)。メモの | は打ち消されて、列が増えない
    const row = markdown.split("\n").find((line) => line.startsWith("| \\[リンク"));
    assert.equal(row.match(/(?<!\\)\|/g).length, 4);
    assert.ok(row.includes("a \\| b c"));
  });

  it("名前の改行は、空白になる(1行に収まる)", () => {
    let data = ok(addApp(initialData(), "一行目\n二行目", counter()));
    data = ok(
      addOperation(data, { appId: "a1", name: "x\r\ny", keysText: "A", note: "" }, counter()),
    );
    const markdown = toMarkdown(sheetModel(data));
    assert.ok(markdown.includes("### 一行目 二行目"));
    assert.ok(markdown.includes("| x y |"));
  });

  it("バッククォートのキー(Ctrl+`)は、コードの囲みを長くして、壊さない", () => {
    let data = ok(addApp(initialData(), "エディタ", counter()));
    data = ok(
      addOperation(
        data,
        { appId: "a1", name: "ターミナル", keysText: "Ctrl+`", note: "" },
        counter(),
      ),
    );
    const markdown = toMarkdown(sheetModel(data));
    assert.ok(markdown.includes("| ターミナル | `` Ctrl+` `` |"));
  });
});

describe("Markdown の部品", () => {
  it("escapeMarkdown: 文の途中でも意味を持つ文字だけを、打ち消す", () => {
    assert.equal(escapeMarkdown("C# の新規 (a-b) 2.5"), "C# の新規 (a-b) 2.5");
    assert.equal(
      escapeMarkdown("a [b](c) <i>x</i> *e* _u_ | `c` &amp; ~s~ \\"),
      "a \\[b\\](c) \\<i\\>x\\</i\\> \\*e\\* \\_u\\_ \\| \\`c\\` \\&amp; \\~s\\~ \\\\",
    );
    assert.equal(escapeMarkdown("  前後の空白  "), "前後の空白");
    assert.equal(escapeMarkdown(5), "5");
  });

  it("escapeMarkdown: 行頭だけで意味を持つものは、lineStart のときだけ打ち消す", () => {
    for (const [input, expected] of [
      ["# 見出し", "\\# 見出し"],
      ["- 項目", "\\- 項目"],
      ["+ 項目", "\\+ 項目"],
      ["> 引用", "\\> 引用"],
      ["= x", "\\= x"],
      ["1. 手順", "1\\. 手順"],
      ["12) 手順", "12\\) 手順"],
      ["2026年", "2026年"],
      ["説明 # 途中", "説明 # 途中"],
    ]) {
      assert.equal(escapeMarkdown(input, { lineStart: true }), expected, input);
    }
    assert.equal(escapeMarkdown("# 見出し"), "# 見出し");
  });

  it("codeSpan: 中のバッククォートより長い囲みで、囲む", () => {
    assert.equal(codeSpan("Ctrl+T"), "`Ctrl+T`");
    assert.equal(codeSpan("Ctrl+`"), "`` Ctrl+` ``");
    assert.equal(codeSpan("`"), "`` ` ``");
    assert.equal(codeSpan("a``b"), "```a``b```");
  });
});
