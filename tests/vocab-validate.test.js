// 語録の原稿の検証・正規化のテスト(Phase 14 PR 1)。規則ごとに、成功と失敗を確かめる。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMatcher } from "../public/assets/js/games/escape-boss/romaji.js";
import {
  LIMITS,
  PUBLISHED_KEYS,
  generateRomaji,
  isValidDate,
  toPublished,
  validateAcross,
  validateVocabulary,
} from "../scripts/lib/vocab-validate.mjs";

const ROLES = ["senpai", "kakaricho", "buchou", "shachou", "kaicho"];
const DIFFICULTIES = ["easy", "normal", "hard"];
const context = {
  jobs: [{ id: "demo", name: "デモ" }],
  roleIds: ROLES,
  difficultyIds: DIFFICULTIES,
};

const item = (n, overrides = {}) => ({
  id: `demo-${String(n).padStart(3, "0")}`,
  japanese: `語${n}`,
  reading: `ご${"あいうえおかきくけこ"[n % 10]}`,
  category: "開発",
  difficulty: 1,
  roles: ["senpai", "kakaricho"],
  explanation: `語${n}の説明。`,
  ...overrides,
});
const file = (items, overrides = {}) => ({
  job_id: "demo",
  job_name: "デモ",
  version: "1.0.0",
  updated_at: "2026-09-21",
  items,
  ...overrides,
});
const check = (raw) => validateVocabulary(raw, context);
const errorsOf = (raw) => check(raw).errors;
// 問題の一覧に、指定の文字列を含むものがあるか
const has = (errors, text) => errors.some((message) => message.includes(text));

describe("正しい原稿", () => {
  it("最小の項目(必須だけ)で、通る。省略した項目は、既定で補う", () => {
    const { errors, data } = check(file([item(1)]));
    assert.deepEqual(errors, []);
    const [word] = data.items;
    assert.deepEqual(word.related_terms, []);
    assert.deepEqual(word.learning_points, []);
    assert.deepEqual(word.weak_detection, { enabled: true });
    assert.equal(word.review, "pending");
    assert.equal(word.draft, false);
    assert.ok(!("note" in word));
  });

  it("ローマ字を省略すると、読みから作る(標準の表記 + 訓令式の表記)。作った候補は、すべて入力できる", () => {
    const { data } = check(file([item(1, { reading: "しゃしん" })]));
    assert.deepEqual(data.items[0].romaji, ["shashinn", "syasinn"]);
    for (const reading of ["ばぐ", "ちゅうもん", "じゅぎょう", "ふぁいる", "にっぽん", "こーど"]) {
      for (const candidate of generateRomaji(reading)) {
        const matcher = createMatcher(reading);
        for (const char of candidate)
          assert.notEqual(matcher.input(char), "miss", `${reading}: ${candidate}`);
        assert.ok(matcher.done, `${reading}: ${candidate}`);
      }
    }
    assert.deepEqual(generateRomaji("ばぐ"), ["bagu"]);
  });

  it("ローマ字を書く場合: 先頭が標準の表記で、すべて入力できれば、通る", () => {
    assert.deepEqual(
      errorsOf(file([item(1, { reading: "しごと", romaji: ["shigoto", "sigoto"] })])),
      [],
    );
  });

  it("review: confirmed・draft: true・note・weak_detection・関連用語・学習ポイントを、受け取る", () => {
    const words = [
      item(1, {
        japanese: "甲",
        related_terms: ["乙"],
        learning_points: ["ポイント 1"],
        review: "confirmed",
        note: "メモ",
      }),
      item(2, { japanese: "乙", reading: "おつ", weak_detection: { enabled: false } }),
      item(3, { japanese: "丙", reading: "へい", draft: true }),
    ];
    const { errors, data } = check(file(words));
    assert.deepEqual(errors, [], errors.join("\n"));
    assert.equal(data.items[0].note, "メモ");
    assert.equal(data.items[2].draft, true);
    assert.deepEqual(data.items[1].weak_detection, { enabled: false });
  });
});

describe("職種の情報", () => {
  it("必須の項目・未知の項目・職種の対応", () => {
    assert.ok(has(errorsOf(file([item(1)], { extra: 1 })), '未知の項目 "extra"'));
    const missing = file([item(1)]);
    delete missing.version;
    assert.ok(has(errorsOf(missing), "version は必須"));
    assert.ok(has(errorsOf(file([item(1)], { job_id: "unknown" })), "jobs.json にありません"));
    assert.ok(has(errorsOf(file([item(1)], { job_name: "別の名前" })), "jobs.json の名前"));
  });

  it("version は 1.2.3 の形、updated_at は実在する日付", () => {
    for (const version of ["1.0", "v1.0.0", 1, "1.0.0.0", ""]) {
      assert.ok(has(errorsOf(file([item(1)], { version })), "version"), String(version));
    }
    for (const updated_at of ["2026-02-30", "2026-9-21", "昨日", 20260921, "2026-13-01"]) {
      assert.ok(has(errorsOf(file([item(1)], { updated_at })), "updated_at"), String(updated_at));
    }
    assert.ok(isValidDate("2028-02-29") && !isValidDate("2027-02-29"));
  });

  it("items が空・一覧でない場合は、エラー", () => {
    for (const items of [[], null, "x", {}]) {
      assert.ok(has(errorsOf(file(items)), "items"), JSON.stringify(items));
    }
    assert.ok(errorsOf(null).length > 0 && errorsOf([]).length > 0 && errorsOf("x").length > 0);
  });
});

describe("id・日本語・読み", () => {
  it("id は、職種の id + - + 3 桁の数字。重複はエラー", () => {
    for (const id of ["demo-1", "demo-0001", "other-001", "DEMO-001", "demo_001", "demo-001 "]) {
      assert.ok(has(errorsOf(file([item(1, { id })])), "id"), id);
    }
    assert.ok(has(errorsOf(file([item(1), item(2, { id: "demo-001" })])), "id が重複"));
  });

  it("日本語の表記: 重複・空白・空・長すぎ・文字列でない、はエラー", () => {
    assert.ok(
      has(
        errorsOf(file([item(1, { japanese: "重複" }), item(2, { japanese: "重複" })])),
        "日本語の表記が重複",
      ),
    );
    assert.ok(has(errorsOf(file([item(1, { japanese: "空 白" })])), "空白を入れないで"));
    assert.ok(has(errorsOf(file([item(1, { japanese: "" })])), "japanese"));
    assert.ok(
      has(
        errorsOf(file([item(1, { japanese: "あ".repeat(LIMITS.japanese + 1) })])),
        "文字までです",
      ),
    );
    assert.ok(has(errorsOf(file([item(1, { japanese: 123 })])), "文字列にしてください"));
    assert.ok(has(errorsOf(file([item(1, { japanese: " 前後 " })])), "前後に空白"));
  });

  it("読み: ひらがなと長音だけ。重複・入力できない文字は、エラー", () => {
    for (const reading of ["カタカナ", "abc", "かな漢字", "か な", "ぐ、", "かーぱ1"]) {
      assert.ok(has(errorsOf(file([item(1, { reading })])), "reading"), reading);
    }
    assert.ok(
      has(
        errorsOf(file([item(1, { reading: "ばぐ" }), item(2, { reading: "ばぐ" })])),
        "読みが重複",
      ),
    );
    assert.deepEqual(errorsOf(file([item(1, { reading: "こーど" })])), []);
  });

  it("制御文字・見えない文字(向きを変える文字・幅のない文字・改行)は、どの文字列にも入れられない", () => {
    for (const code of [0x202e, 0x2066, 0x200b, 0xfeff, 0x0000, 0x0007, 0x2028]) {
      const hex = code.toString(16);
      const char = String.fromCodePoint(code);
      // 語の途中に入れる: 見えない文字のエラー
      for (const key of ["japanese", "category", "explanation"]) {
        const value = key === "explanation" ? `説明${char}です。` : `語${char}語`;
        assert.ok(
          has(errorsOf(file([item(1, { [key]: value })])), "見えない文字"),
          `${key} ${hex}`,
        );
      }
      // 端に入れる: 空白として取り除かれる文字は「前後に空白」、そうでなければ「見えない文字」。どちらも、エラー
      assert.ok(errorsOf(file([item(1, { japanese: `語${char}` })])).length > 0, hex);
      assert.ok(errorsOf(file([item(1, { note: `メモ${char}` })])).length > 0, hex);
    }
  });
});

describe("ローマ字", () => {
  it("形式(英小文字と - だけ)・個数・重複", () => {
    assert.ok(has(errorsOf(file([item(1, { reading: "ばぐ", romaji: ["BAGU"] })])), "英小文字"));
    assert.ok(has(errorsOf(file([item(1, { reading: "ばぐ", romaji: ["ba gu"] })])), "英小文字"));
    assert.ok(has(errorsOf(file([item(1, { reading: "ばぐ", romaji: [] })])), "romaji"));
    assert.ok(has(errorsOf(file([item(1, { reading: "ばぐ", romaji: "bagu" })])), "romaji"));
    assert.ok(
      has(errorsOf(file([item(1, { reading: "ばぐ", romaji: ["bagu", "bagu"] })])), "重複"),
    );
    assert.ok(
      has(
        errorsOf(
          file([
            item(1, {
              reading: "ばぐ",
              romaji: Array.from({ length: 9 }, (_, i) => `bagu${"a".repeat(i)}`),
            }),
          ]),
        ),
        "romaji",
      ),
    );
  });

  it("先頭は、画面に表示する書き方(標準)。ほかも、その読みで、最後まで入力できること", () => {
    assert.ok(
      has(errorsOf(file([item(1, { reading: "しごと", romaji: ["sigoto", "shigoto"] })])), "先頭"),
    );
    assert.ok(
      has(
        errorsOf(file([item(1, { reading: "しごと", romaji: ["shigoto", "shigotou"] })])),
        "入力できません",
      ),
    );
    assert.ok(
      has(
        errorsOf(file([item(1, { reading: "しごと", romaji: ["shigoto", "sigot"] })])),
        "入力できません",
      ),
    );
  });
});

describe("そのほかの項目", () => {
  it("難易度: 1〜5 の整数", () => {
    for (const difficulty of [0, 6, 1.5, "2", null, -1]) {
      assert.ok(has(errorsOf(file([item(1, { difficulty })])), "difficulty"), String(difficulty));
    }
    for (const difficulty of [1, 3, 5])
      assert.deepEqual(errorsOf(file([item(1, { difficulty })])), []);
  });

  it("役職: 実在する役職 id の一覧(1 つ以上・重複なし)", () => {
    assert.ok(has(errorsOf(file([item(1, { roles: [] })])), "roles"));
    assert.ok(has(errorsOf(file([item(1, { roles: "senpai" })])), "roles"));
    assert.ok(has(errorsOf(file([item(1, { roles: ["senpai", "unknown"] })])), "知らない役職"));
    assert.ok(has(errorsOf(file([item(1, { roles: ["senpai", "senpai"] })])), "重複"));
  });

  it("難易度専用(difficulties。Phase 24): 省略できる。書けば、実在する難易度 id の一覧(1 つ以上・重複なし)", () => {
    const { errors, data } = check(file([item(1)]));
    assert.deepEqual(errors, []);
    assert.ok(!("difficulties" in data.items[0]), "省略時は、項目自体を作らない");

    const ok = check(file([item(1, { difficulties: ["hard"] })]));
    assert.deepEqual(ok.errors, []);
    assert.deepEqual(ok.data.items[0].difficulties, ["hard"]);

    assert.ok(has(errorsOf(file([item(1, { difficulties: [] })])), "difficulties"));
    assert.ok(has(errorsOf(file([item(1, { difficulties: "hard" })])), "difficulties"));
    assert.ok(
      has(errorsOf(file([item(1, { difficulties: ["hard", "unknown"] })])), "知らない難易度"),
    );
    assert.ok(has(errorsOf(file([item(1, { difficulties: ["hard", "hard"] })])), "重複"));
  });

  it("説明: 「。」で終わる 80 字以内の 1 行", () => {
    assert.ok(has(errorsOf(file([item(1, { explanation: "句点がない" })])), "「。」で終わる"));
    assert.ok(
      has(
        errorsOf(file([item(1, { explanation: `${"あ".repeat(LIMITS.explanation)}。` })])),
        "文字までです",
      ),
    );
    assert.ok(has(errorsOf(file([item(1, { explanation: "改行\nあり。" })])), "見えない文字"));
    assert.deepEqual(
      errorsOf(file([item(1, { explanation: `${"あ".repeat(LIMITS.explanation - 1)}。` })])),
      [],
    );
  });

  it("カテゴリ: 空でない 20 字以内", () => {
    assert.ok(has(errorsOf(file([item(1, { category: "" })])), "category"));
    assert.ok(has(errorsOf(file([item(1, { category: "あ".repeat(21) })])), "category"));
  });

  it("学習ポイント: 5 個まで・各 60 字まで・空でない・重複なし", () => {
    assert.ok(
      has(
        errorsOf(
          file([item(1, { learning_points: Array.from({ length: 6 }, (_, i) => `p${i}`) })]),
        ),
        "learning_points",
      ),
    );
    assert.ok(
      has(errorsOf(file([item(1, { learning_points: ["あ".repeat(61)] })])), "learning_points"),
    );
    assert.ok(has(errorsOf(file([item(1, { learning_points: [""] })])), "learning_points"));
    assert.ok(has(errorsOf(file([item(1, { learning_points: "x" })])), "learning_points"));
    assert.ok(has(errorsOf(file([item(1, { learning_points: ["同じ", "同じ"] })])), "重複"));
    assert.deepEqual(errorsOf(file([item(1, { learning_points: ["a", "b", "c", "d", "e"] })])), []);
  });

  it("苦手判定: enabled だけを持つ、真偽値", () => {
    for (const weak_detection of [
      { enabled: "yes" },
      {},
      { enabled: true, extra: 1 },
      true,
      null,
      [],
    ]) {
      assert.ok(
        has(errorsOf(file([item(1, { weak_detection })])), "weak_detection"),
        JSON.stringify(weak_detection),
      );
    }
  });

  it("未知の項目・必須の欠け・項目でない語は、エラー", () => {
    assert.ok(has(errorsOf(file([item(1, { extra_field: "詳細" })])), '未知の項目 "extra_field"'));
    const missing = item(1);
    delete missing.explanation;
    assert.ok(has(errorsOf(file([missing])), "explanation は必須"));
    assert.ok(has(errorsOf(file(["語だけ"])), "項目名と値の組"));
  });

  it("review・draft・note の値", () => {
    assert.ok(has(errorsOf(file([item(1, { review: "done" })])), "review"));
    assert.ok(has(errorsOf(file([item(1, { draft: "true" })])), "draft"));
    assert.ok(has(errorsOf(file([item(1, { note: "あ".repeat(LIMITS.note + 1) })])), "note"));
    assert.ok(has(errorsOf(file([item(1, { note: "" })])), "note"));
  });
});

describe("関連用語", () => {
  const terms = (related, more = {}) =>
    file([
      item(1, { japanese: "甲", related_terms: related, ...more }),
      item(2, { japanese: "乙", reading: "おつ" }),
    ]);

  it("同じ職種の、ほかの語(日本語)を指せる", () => {
    assert.deepEqual(errorsOf(terms(["乙"])), []);
  });

  it("職種にない語・自分自身・重複・11 個以上は、エラー", () => {
    assert.ok(has(errorsOf(terms(["丙"])), "同じ職種にありません"));
    assert.ok(has(errorsOf(terms(["甲"])), "自分自身"));
    assert.ok(has(errorsOf(terms(["乙", "乙"])), "重複"));
    assert.ok(has(errorsOf(terms(Array.from({ length: 11 }, (_, i) => `x${i}`))), "related_terms"));
  });

  it("公開する語は、下書きの語を指せない(公開の語録が、壊れるため)。下書きどうしは、よい", () => {
    const draftTarget = file([
      item(1, { japanese: "甲", related_terms: ["乙"] }),
      item(2, { japanese: "乙", reading: "おつ", draft: true }),
    ]);
    assert.ok(has(errorsOf(draftTarget), "下書きです"));
    const bothDraft = file([
      item(1, { japanese: "甲", related_terms: ["乙"], draft: true }),
      item(2, { japanese: "乙", reading: "おつ", draft: true }),
    ]);
    assert.deepEqual(errorsOf(bothDraft), []);
    const draftPointsPublished = file([
      item(1, { japanese: "甲", related_terms: ["乙"], draft: true }),
      item(2, { japanese: "乙", reading: "おつ" }),
    ]);
    assert.deepEqual(errorsOf(draftPointsPublished), []);
  });
});

describe("問題は、すべて集める", () => {
  it("1 つの原稿に、複数の問題があれば、すべて返す(1 つ目で止めない)", () => {
    const errors = errorsOf(
      file([
        item(1, { difficulty: 9, roles: [] }),
        item(2, { explanation: "句点なし", reading: "ABC" }),
        item(3, { id: "bad" }),
      ]),
    );
    assert.ok(errors.length >= 5, errors.join("\n"));
    assert.ok(
      has(errors, "difficulty") &&
        has(errors, "roles") &&
        has(errors, "explanation") &&
        has(errors, "reading") &&
        has(errors, "id"),
    );
  });

  it("エラーの文は、どの語(id と日本語)の問題かを、示す", () => {
    const errors = errorsOf(file([item(1, { difficulty: 9 })]));
    assert.ok(errors[0].startsWith("demo-001(語1): "), errors[0]);
  });
});

describe("職種をまたぐ検査(validateAcross)", () => {
  const data = (jobId, items) => check(file(items, { job_id: jobId, job_name: "デモ" })).data;
  const mk = (jobId, items) => ({ name: `${jobId}.md`, data: { job_id: jobId, items } });

  it("id・日本語が、職種をまたいで重複していれば、エラー", () => {
    const errors = validateAcross([
      mk("a", [
        { id: "a-001", japanese: "同じ" },
        { id: "a-002", japanese: "別" },
      ]),
      mk("b", [{ id: "a-001", japanese: "同じ" }]),
    ]);
    assert.ok(has(errors, "id が"));
    assert.ok(has(errors, "日本語の表記が"));
    void data;
  });

  it("重複がなければ、空。job_id の重複も、エラー", () => {
    assert.deepEqual(
      validateAcross([
        mk("a", [{ id: "a-001", japanese: "甲" }]),
        mk("b", [{ id: "b-001", japanese: "乙" }]),
      ]),
      [],
    );
    assert.ok(
      has(
        validateAcross([mk("a", []), { name: "x.md", data: { job_id: "a", items: [] } }]),
        "job_id",
      ),
    );
  });
});

describe("公開の形(toPublished)", () => {
  it("下書きと、原稿だけの項目(review・draft・note)を除き、決まった順序の項目だけにする", () => {
    const { data } = check(
      file([
        item(1, { note: "メモ", review: "confirmed" }),
        item(2, { draft: true }),
        item(3, { reading: "ごう" }),
      ]),
    );
    const published = toPublished(data);
    assert.equal(published.items.length, 2);
    for (const word of published.items) {
      assert.deepEqual(
        Object.keys(word),
        PUBLISHED_KEYS.filter((key) => !["detail", "difficulties"].includes(key)),
      );
    }
    assert.deepEqual(Object.keys(published), [
      "job_id",
      "job_name",
      "version",
      "updated_at",
      "items",
    ]);
    assert.ok(!JSON.stringify(published).includes("メモ"));
  });
});

describe("詳細説明(detail。難語のための、少し長い説明)", () => {
  const longEnough = `${"あ".repeat(LIMITS.detail - 1)}。`;

  it("省略できる。書けば、正規化した項目に入る。書かない語には、項目を作らない", () => {
    const { errors, data } = check(
      file([item(1, { detail: "詳しい説明です。短文では足りない語のためのものです。" }), item(2)]),
    );
    assert.deepEqual(errors, []);
    assert.equal(data.items[0].detail, "詳しい説明です。短文では足りない語のためのものです。");
    assert.ok(!("detail" in data.items[1]));
  });

  it("300 字まで。「。」で終わる。空・文字列でない・改行・見えない文字は、エラー", () => {
    assert.equal(LIMITS.detail, 300);
    assert.deepEqual(errorsOf(file([item(1, { detail: longEnough })])), []);
    assert.ok(has(errorsOf(file([item(1, { detail: `${longEnough}あ。` })])), "文字までです"));
    assert.ok(has(errorsOf(file([item(1, { detail: "句点がない" })])), "「。」で終わる"));
    assert.ok(has(errorsOf(file([item(1, { detail: "" })])), "detail"));
    assert.ok(has(errorsOf(file([item(1, { detail: 123 })])), "detail は、文字列"));
    assert.ok(has(errorsOf(file([item(1, { detail: null })])), "detail"));
    assert.ok(has(errorsOf(file([item(1, { detail: "改行\nあり。" })])), "見えない文字"));
    assert.ok(
      has(
        errorsOf(file([item(1, { detail: `向き${String.fromCodePoint(0x202e)}変え。` })])),
        "見えない文字",
      ),
    );
  });

  it("公開の形には、あるときだけ入る。explanation の直後に置く", () => {
    const { data } = check(file([item(1, { detail: "詳しい説明です。" }), item(2)]));
    const published = toPublished(data);
    const keys = (word) => Object.keys(word);
    assert.deepEqual(
      keys(published.items[0]),
      PUBLISHED_KEYS.filter((key) => key !== "difficulties"),
    );
    assert.deepEqual(
      keys(published.items[1]),
      PUBLISHED_KEYS.filter((key) => !["detail", "difficulties"].includes(key)),
    );
    const order = keys(published.items[0]);
    assert.equal(order.indexOf("detail"), order.indexOf("explanation") + 1);
  });

  it("下書きの語の詳細説明も、検証する。公開の JSON には入らない", () => {
    const { errors, data } = check(
      file([item(1), item(2, { draft: true, detail: "詳しい説明です。" })]),
    );
    assert.deepEqual(errors, []);
    assert.equal(toPublished(data).items.length, 1);
    assert.ok(
      has(errorsOf(file([item(1, { draft: true, detail: "句点なし" })])), "「。」で終わる"),
    );
  });
});

describe("難易度専用(difficulties)の公開の形", () => {
  it("省略した語には、項目を作らない。書いた語は、roles の直後・explanation の前に置く", () => {
    const { data } = check(file([item(1, { difficulties: ["hard"] }), item(2)]));
    const published = toPublished(data);
    const keys = (word) => Object.keys(word);
    assert.deepEqual(
      keys(published.items[0]),
      PUBLISHED_KEYS.filter((key) => key !== "detail"),
    );
    assert.deepEqual(
      keys(published.items[1]),
      PUBLISHED_KEYS.filter((key) => !["detail", "difficulties"].includes(key)),
    );
    const order = keys(published.items[0]);
    assert.equal(order.indexOf("difficulties"), order.indexOf("roles") + 1);
    assert.equal(order.indexOf("difficulties"), order.indexOf("explanation") - 1);
    assert.deepEqual(published.items[0].difficulties, ["hard"]);
  });
});
