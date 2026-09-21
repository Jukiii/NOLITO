// 語録の原稿(Markdown)の読み取りと書き出しのテスト(Phase 14 PR 1)。
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  extractYaml,
  parseVocabularyMarkdown,
  stringifyVocabularyMarkdown,
  stringifyVocabularyYaml,
} from "../scripts/lib/vocab-md.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const fence = (yaml) => `\`\`\`yaml\n${yaml}\n\`\`\``;
const BOM = String.fromCodePoint(0xfeff);

describe("YAML の取り出し(extractYaml)", () => {
  it("```yaml で囲んだ部分の中身を取り出す。前後の文章は、無視する", () => {
    const text = `# 見出し\n\n説明の文章。\n\n${fence("a: 1\nb: 2")}\n\n作成メモ。\n`;
    assert.equal(extractYaml(text), "a: 1\nb: 2");
  });

  it("改行が CRLF でも・先頭に BOM があっても、読める", () => {
    assert.equal(extractYaml(`${BOM}${fence("a: 1")}`.replaceAll("\n", "\r\n")), "a: 1");
  });

  it("YAML の囲みがない・2 つ以上ある場合は、エラー", () => {
    assert.throws(() => extractYaml("# だけ\n\n本文"), /ありません/);
    assert.throws(() => extractYaml("```json\n{}\n```"), /ありません/);
    assert.throws(() => extractYaml(`${fence("a: 1")}\n\n${fence("b: 2")}`), /2 個/);
  });

  it("囲みの中に、別のコードの囲み(```)がある文章は、YAML として、取り出さない", () => {
    assert.throws(() => extractYaml("```yaml\na: 1\n"), /ありません/);
  });
});

describe("YAML の読み取り(parseVocabularyMarkdown)", () => {
  it("項目名と値の組を、オブジェクトにする。数・真偽・一覧・入れ子", () => {
    const data = parseVocabularyMarkdown(
      fence("n: 3\nflag: true\nlist: [a, b]\nnested:\n  enabled: false\ntext: ふつうの文字"),
    );
    assert.deepEqual(data, {
      n: 3,
      flag: true,
      list: ["a", "b"],
      nested: { enabled: false },
      text: "ふつうの文字",
    });
  });

  it("日付らしい値は、文字列のまま(Date にしない)。yes・no も、文字列", () => {
    const data = parseVocabularyMarkdown(fence("updated_at: 2026-09-21\nv: 1.2.3\nword: yes"));
    assert.equal(data.updated_at, "2026-09-21");
    assert.equal(data.v, "1.2.3");
    assert.equal(data.word, "yes");
  });

  it("同じ名前の項目が 2 回ある場合は、エラー(あとの値で上書きしない)", () => {
    assert.throws(() => parseVocabularyMarkdown(fence("a: 1\na: 2")), /YAML を読み取れません/);
  });

  it("別名(アンカー)・型の指定(!!)・結合(<<)は、使えない", () => {
    assert.throws(
      () => parseVocabularyMarkdown(fence("a: &x [1]\nb: *x")),
      /使えない|読み取れません/,
    );
    assert.throws(
      () => parseVocabularyMarkdown(fence("a: !!python/object/apply:os.system [ls]")),
      /使えない|読み取れません/,
    );
    assert.throws(
      () => parseVocabularyMarkdown(fence("base: &b\n  x: 1\nother:\n  <<: *b")),
      /使えない|読み取れません/,
    );
  });

  it("書き方の間違い(タブ・インデントのずれ・閉じていない引用符)は、エラー", () => {
    assert.throws(() => parseVocabularyMarkdown(fence("a:\n\t- 1")), /YAML/);
    assert.throws(() => parseVocabularyMarkdown(fence('a: "閉じていない')), /YAML/);
    assert.throws(() => parseVocabularyMarkdown(fence("a: [1, 2")), /YAML/);
  });

  it("項目名と値の組でないもの(一覧・文字・空)は、エラー", () => {
    for (const yaml of ["- a\n- b", "ただの文字", "# コメントだけ"]) {
      assert.throws(() => parseVocabularyMarkdown(fence(yaml)), /項目名と値の組|YAML/, yaml);
    }
  });

  it("エラーの文は、1 行(内部の長い情報を、そのまま出さない)", () => {
    try {
      parseVocabularyMarkdown(fence("a: [1, 2"));
      assert.fail("エラーになるはず");
    } catch (error) {
      assert.ok(!error.message.includes("\n"));
    }
  });
});

const sample = () => ({
  job_id: "demo",
  job_name: "デモ",
  version: "1.0.0",
  updated_at: "2026-09-21",
  items: [
    {
      id: "demo-001",
      japanese: "バグ",
      reading: "ばぐ",
      romaji: ["bagu"],
      category: "開発",
      difficulty: 1,
      roles: ["senpai", "kaicho"],
      explanation: "プログラムの不具合や誤りのこと。",
      related_terms: ["デバッグ"],
      learning_points: [],
      weak_detection: { enabled: true },
      review: "pending",
    },
    {
      id: "demo-002",
      japanese: "コロン: あり",
      reading: "ころん",
      romaji: ["koronn"],
      category: "# 記号で始まる",
      difficulty: 2,
      roles: ["senpai"],
      explanation: '引用符 " と \\ と #、[かっこ]、{中かっこ}、a: b を含む。',
      related_terms: ["a, b", "[x]"],
      learning_points: ["- ハイフンで始まる", "true", "123", "null", "~"],
      weak_detection: { enabled: false },
      review: "confirmed",
      draft: true,
      note: "メモ: 確認してください #1",
    },
    {
      id: "demo-003",
      japanese: "123",
      reading: "いちにさん",
      romaji: ["ichinisann"],
      category: "yes",
      difficulty: 3,
      roles: ["buchou"],
      explanation: "数字だけの語。",
      related_terms: [],
      learning_points: ["  前後に空白  ".trim()],
      weak_detection: { enabled: true },
    },
  ],
});

describe("書き出し(stringifyVocabularyMarkdown)", () => {
  it("読み取ると、同じ値に戻る(特殊な文字・数字だけの語・真偽値に見える文字列も)", () => {
    const data = sample();
    assert.deepEqual(parseVocabularyMarkdown(stringifyVocabularyMarkdown(data)), {
      ...data,
      items: data.items.map((item) => ({ ...item })),
    });
  });

  it("特殊な文字を含む文字列は、二重引用符で書く。ふつうの文字列は、引用符なし", () => {
    const yaml = stringifyVocabularyYaml(sample());
    assert.match(yaml, /japanese: バグ\n/);
    assert.match(yaml, /japanese: "コロン: あり"\n/);
    assert.match(yaml, /japanese: "123"\n/);
    assert.match(yaml, /category: "yes"\n/);
    assert.match(yaml, /category: "# 記号で始まる"\n/);
  });

  it("一覧は、[a, b] の形で 1 行に書く。空は []", () => {
    const yaml = stringifyVocabularyYaml(sample());
    assert.match(yaml, /roles: \[senpai, kaicho\]/);
    assert.match(yaml, /learning_points: \[\]/);
    assert.match(yaml, /related_terms: \["a, b", "\[x\]"\]/);
  });

  it("review・draft・note は、あるときだけ書く(draft は true のときだけ)", () => {
    const yaml = stringifyVocabularyYaml(sample());
    assert.equal(yaml.match(/review: /g).length, 2);
    assert.equal(yaml.match(/draft: true/g).length, 1);
    assert.equal(yaml.match(/note: /g).length, 1);
  });

  it("intro を、YAML の前に置く。同じ入力は、いつも同じ出力(決まった順序)", () => {
    const text = stringifyVocabularyMarkdown(sample(), { intro: "# 見出し\n\n説明" });
    assert.ok(text.startsWith("# 見出し\n\n説明\n\n```yaml\njob_id: demo\n"));
    assert.ok(text.endsWith("```\n"));
    assert.equal(text, stringifyVocabularyMarkdown(sample(), { intro: "# 見出し\n\n説明" }));
  });

  it("制御文字・見えない文字を含む文字列は、二重引用符で、エスケープして書く(原稿に、直接は出ない)", () => {
    const data = sample();
    data.items[0].explanation = `a${String.fromCodePoint(0x202e)}b${String.fromCodePoint(0x200b)}。`;
    const text = stringifyVocabularyMarkdown(data);
    assert.ok(!text.includes(String.fromCodePoint(0x202e)));
    assert.ok(!text.includes(String.fromCodePoint(0x200b)));
    assert.equal(parseVocabularyMarkdown(text).items[0].explanation, data.items[0].explanation);
  });
});

describe("実際の原稿(content/vocabulary/*.md)", () => {
  const files = readdirSync(`${root}content/vocabulary`).filter((name) => name.endsWith(".md"));
  const read = (name) =>
    readFileSync(`${root}content/vocabulary/${name}`, "utf8").replaceAll("\r\n", "\n");

  it("職種ごとに 1 ファイル(6 職種)。すべて読み取れる", () => {
    assert.equal(files.length, 6);
    for (const name of files) {
      const data = parseVocabularyMarkdown(read(name));
      assert.equal(`${data.job_id}.md`, name);
      assert.ok(Array.isArray(data.items) && data.items.length >= 30, name);
    }
  });

  it("原稿に、制御文字・見えない文字を、直接書いていない", () => {
    const hidden = /[\p{Cc}\p{Cf}]/u;
    for (const name of files) {
      const text = read(name);
      for (const char of text) {
        if (char === "\n" || char === "\t") continue;
        assert.ok(!hidden.test(char), `${name}: U+${char.codePointAt(0).toString(16)}`);
      }
    }
  });

  it("書き出し → 読み取りで、同じ値に戻る(全 180 語)", () => {
    for (const name of files) {
      const data = parseVocabularyMarkdown(read(name));
      assert.deepEqual(parseVocabularyMarkdown(stringifyVocabularyMarkdown(data)), data, name);
    }
  });
});

describe("詳細説明(detail)の書き出し", () => {
  it("explanation の直後に書く。ない語には、行を作らない。読み取ると、同じ値に戻る", () => {
    const data = sample();
    data.items[1].detail = '詳しい説明: 引用符 " と # と [かっこ] を含む。';
    const yaml = stringifyVocabularyYaml(data);
    assert.equal(yaml.match(/detail: /g).length, 1);
    const lines = yaml.split("\n");
    const at = lines.findIndex((line) => line.startsWith("    detail: "));
    assert.ok(lines[at - 1].startsWith("    explanation: "));
    assert.ok(lines[at + 1].startsWith("    related_terms: "));
    assert.equal(
      parseVocabularyMarkdown(stringifyVocabularyMarkdown(data)).items[1].detail,
      data.items[1].detail,
    );
  });
});
