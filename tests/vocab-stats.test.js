// 語録の統計・点検・確認シートのテスト(Phase 11 PR 1)。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  TARGETS,
  expectedDifficulty,
  findIssues,
  formatStats,
  jobStats,
  readingUnits,
  reviewSheet,
} from "../scripts/lib/vocab-stats.mjs";
import { loadNotes, loadVocabularies, readSheet } from "../scripts/lib/vocab-io.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const vocabularies = loadVocabularies();
const notes = loadNotes();
const roles = JSON.parse(readFileSync(`${root}public/data/roles.json`, "utf8"));
const roleIds = (Array.isArray(roles) ? roles : roles.roles).map((role) => role.id);

const item = (overrides = {}) => ({
  id: "job-001",
  japanese: "テスト",
  reading: "てすと",
  romaji: ["tesuto"],
  category: "開発",
  difficulty: 1,
  roles: ["senpai"],
  explanation: "説明。",
  related_terms: [],
  learning_points: [],
  weak_detection: { enabled: true },
  ...overrides,
});
const job = (items, overrides = {}) => ({
  job_id: "job",
  job_name: "職種",
  version: "1.0.0",
  updated_at: "2026-09-20",
  items,
  ...overrides,
});

describe("読みの長さと難易度の決め", () => {
  it("小さい ゃゅょぁぃぅぇぉ は、前の文字と合わせて 1 つ。っ・ー・ん は 1 つ", () => {
    assert.equal(readingUnits("きゃ"), 1);
    assert.equal(readingUnits("しゅっちょう"), 4);
    assert.equal(readingUnits("こーど"), 3);
    assert.equal(readingUnits("ぷるりくえすと"), 7);
    assert.equal(readingUnits("ふぁ"), 1);
    assert.equal(readingUnits(""), 0);
  });

  it("難易度: 3 以下 = 1、4〜5 = 2、6 以上 = 3(決定ログ 0006)", () => {
    for (const [units, level] of [
      [1, 1],
      [3, 1],
      [4, 2],
      [5, 2],
      [6, 3],
      [12, 3],
    ]) {
      assert.equal(expectedDifficulty(units), level, String(units));
    }
  });
});

describe("統計", () => {
  it("語数・難易度・カテゴリ・読みの長さを数える。難易度は、なくても 0 で出る", () => {
    const stats = jobStats(
      job([
        item({ id: "a", reading: "てすと", difficulty: 1, category: "開発" }),
        item({
          id: "b",
          japanese: "べ",
          reading: "ふれーむわーく",
          difficulty: 3,
          category: "インフラ",
        }),
        item({ id: "c", japanese: "し", reading: "しゅ", difficulty: 1, category: "開発" }),
      ]),
    );
    assert.equal(stats.words, 3);
    assert.deepEqual(stats.byDifficulty, { 1: 2, 2: 0, 3: 1 });
    assert.deepEqual(stats.byCategory, { 開発: 2, インフラ: 1 });
    assert.deepEqual([stats.readingUnits.min, stats.readingUnits.max], [1, 7]);
    assert.ok(Math.abs(stats.readingUnits.average - 11 / 3) < 1e-9);
  });

  it("端末の表に、全職種が出る", () => {
    const text = formatStats(vocabularies);
    for (const data of vocabularies) assert.ok(text.includes(data.job_name), data.job_name);
  });
});

describe("点検(合成したデータ)", () => {
  it("重複した id・日本語・読みは、エラー", () => {
    const { errors } = findIssues([
      job([
        item({ id: "a" }),
        item({ id: "a", japanese: "別", reading: "べつ" }),
        item({ id: "b" }),
        item({ id: "c", japanese: "別の", reading: "てすと" }),
      ]),
    ]);
    assert.ok(errors.some((e) => e.includes("id が重複")));
    assert.ok(errors.some((e) => e.includes("日本語表記が重複")));
    assert.ok(errors.some((e) => e.includes("読みが重複")));
  });

  it("難易度が決めと違うものは、警告(エラーにしない)", () => {
    const { errors, warnings } = findIssues([
      job([item({ id: "a", reading: "てすと", difficulty: 3 })]),
    ]);
    assert.deepEqual(errors, []);
    assert.ok(warnings.some((w) => w.includes("難易度 3") && w.includes("決めでは 1")));
  });

  it("語数・難易度ごとの語数・カテゴリの少なさは、警告", () => {
    const { warnings } = findIssues([job([item()])]);
    assert.ok(warnings.some((w) => w.includes(`目標 ${TARGETS.minWordsPerJob} 語以上`)));
    assert.ok(warnings.some((w) => w.includes("難易度 2 が 0 語")));
    assert.ok(warnings.some((w) => w.includes(`カテゴリが 1 種類`)));
  });

  it("目標を満たす職種は、警告が出ない", () => {
    const items = [];
    const readings = {
      1: ["あい", "うえ", "おか", "きく", "けこ", "さし", "すせ", "そた"],
      2: [
        "ちつてと",
        "なにぬね",
        "のはひふ",
        "へほまみ",
        "むめもや",
        "ゆよらり",
        "るれろわ",
        "をんがぎ",
      ],
      3: [
        "ぐげござじずぜ",
        "ぞだぢづでど",
        "ばびぶべぼぱ",
        "ぴぷぺぽきゃ",
        "きゅきょしゃ",
        "しゅしょちゃ",
        "ちゅちょにゃ",
        "にゅにょひゃ",
      ],
    };
    let n = 0;
    for (const level of [1, 2, 3]) {
      for (const reading of readings[level]) {
        n += 1;
        items.push(
          item({
            id: `job-${n}`,
            japanese: `語${n}`,
            reading,
            difficulty: level,
            category: ["開発", "運用", "設計"][n % 3],
          }),
        );
      }
    }
    // きゃ などの小さい文字を含む読みは、単位数が、決めと合わない場合があるので、難易度を、決めに合わせる
    for (const it of items) it.difficulty = expectedDifficulty(readingUnits(it.reading));
    const { errors, warnings } = findIssues([job(items)]);
    assert.deepEqual(errors, []);
    assert.ok(!warnings.some((w) => /語数が|カテゴリが/.test(w)), warnings.join("\n"));
  });

  it("職種をまたいで、同じ日本語の語があれば、警告", () => {
    const { warnings } = findIssues([
      job([item({ id: "a-1", japanese: "在庫", reading: "ざいこ" })], { job_id: "a" }),
      job([item({ id: "b-1", japanese: "在庫", reading: "ざいこ" })], { job_id: "b" }),
    ]);
    assert.ok(warnings.some((w) => w.includes("ほかの職種(a)にもあります")));
  });
});

describe("実際の語録", () => {
  it("エラーがない(重複した id・日本語・読みがない)", () => {
    assert.deepEqual(findIssues(vocabularies).errors, []);
  });

  it("警告がない(難易度が決めどおり・職種ごとに 30 語・難易度ごとに 4 語以上・カテゴリ 3 種類以上)", () => {
    const { warnings } = findIssues(vocabularies);
    assert.deepEqual(warnings, [], warnings.join(" / "));
  });

  it("職種ごとに 30 語。id は連番で、欠けがない(語の id は、消さない・つけ替えない)", () => {
    for (const data of vocabularies) {
      assert.equal(data.items.length, 30, data.job_id);
      data.items.forEach((item, index) => {
        assert.equal(item.id, `${data.job_id}-${String(index + 1).padStart(3, "0")}`);
      });
    }
  });

  it("すべての語の対象の役職が、実在する役職 id で、空でない", () => {
    for (const data of vocabularies) {
      for (const word of data.items) {
        assert.ok(word.roles.length > 0, word.id);
        for (const role of word.roles) assert.ok(roleIds.includes(role), `${word.id}: ${role}`);
      }
    }
  });

  it("説明は、空でなく、「。」で終わり、80 字以内(短文が基本)", () => {
    for (const data of vocabularies) {
      for (const word of data.items) {
        assert.ok(word.explanation.trim() !== "", word.id);
        assert.ok(word.explanation.endsWith("。"), `${word.id}: ${word.explanation}`);
        assert.ok(Array.from(word.explanation).length <= 80, word.id);
      }
    }
  });

  it("日本語の表記に、空白・改行がない。読みは、ひらがな(と ー)だけ", () => {
    for (const data of vocabularies) {
      for (const word of data.items) {
        assert.ok(!/\s/.test(word.japanese), `${word.id}: 空白`);
        assert.match(word.reading, /^[ぁ-ゖー]+$/, `${word.id}: ${word.reading}`);
      }
    }
  });

  it("ローマ字の候補は、小文字の英字と - だけ。1 つ以上ある", () => {
    for (const data of vocabularies) {
      for (const word of data.items) {
        assert.ok(word.romaji.length > 0, word.id);
        for (const candidate of word.romaji)
          assert.match(candidate, /^[a-z-]+$/, `${word.id}: ${candidate}`);
      }
    }
  });

  it("関連する語は、同じ職種の、実在する語(日本語)を指す", () => {
    for (const data of vocabularies) {
      const words = new Set(data.items.map((word) => word.japanese));
      for (const word of data.items) {
        for (const related of word.related_terms) {
          assert.ok(
            words.has(related),
            `${word.id}: 関連する語「${related}」が、同じ職種にありません`,
          );
          assert.notEqual(related, word.japanese, `${word.id}: 自分自身を指しています`);
        }
      }
    }
  });
});

describe("確認シート", () => {
  const sheet = reviewSheet(vocabularies, notes);
  const total = vocabularies.reduce((sum, data) => sum + data.items.length, 0);

  it("すべての語が、1 回ずつ、載っている", () => {
    for (const data of vocabularies) {
      for (const word of data.items) {
        const rows = sheet.split("\n").filter((line) => line.startsWith(`| ${word.id} |`));
        assert.equal(rows.length, 1, word.id);
        assert.ok(rows[0].includes(word.japanese) && rows[0].includes(word.explanation), word.id);
      }
    }
    assert.match(sheet, new RegExp(`全 ${total} 語`));
  });

  it("職種ごとの見出し・確認の観点・返信のしかたが、ある", () => {
    for (const data of vocabularies)
      assert.ok(sheet.includes(`## ${data.job_name}(${data.job_id}`), data.job_id);
    for (const word of ["正確性", "表記", "難易度", "適切さ", "返信のしかた", "下書き"])
      assert.ok(sheet.includes(word), word);
  });

  it("確認メモが、その語の行に入る。ないものは、空欄(undefined と出さない)", () => {
    for (const [id, note] of Object.entries(notes)) {
      const row = sheet.split("\n").find((line) => line.startsWith(`| ${id} |`));
      assert.ok(row.includes(note.replaceAll("|", "\\|")), id);
    }
    assert.ok(!sheet.includes("undefined") && !sheet.includes("null"));
  });

  it("表を壊す文字( | )は、打ち消す", () => {
    const tricky = reviewSheet(
      [job([item({ id: "x-1", explanation: "a|b。", japanese: "縦|線" })])],
      { "x-1": "メモ|あり" },
    );
    const row = tricky.split("\n").find((line) => line.startsWith("| x-1 |"));
    assert.ok(row.includes("a\\|b。") && row.includes("縦\\|線") && row.includes("メモ\\|あり"));
    // 行の区切りとして数えられる、打ち消していない | は、列の数(9 列 = 10 個)と一致する
    assert.equal(row.replace(/\\\|/g, "").split("|").length - 1, 10);
  });

  it("docs/vocabulary-review.md は、いまの語録と一致している(語録を変えたら、npm run vocab:review)", () => {
    assert.equal(readSheet(), sheet);
  });

  it("確認メモの id は、実在する語で、空でなく、200 字以内", () => {
    const ids = new Set(vocabularies.flatMap((data) => data.items.map((word) => word.id)));
    assert.ok(Object.keys(notes).length >= 5);
    for (const [id, note] of Object.entries(notes)) {
      assert.ok(ids.has(id), `${id} は、語録にありません`);
      assert.ok(note.trim() !== "" && Array.from(note).length <= 200, id);
    }
  });
});

describe("コマンド", () => {
  const run = (script, args = []) =>
    spawnSync(process.execPath, [`${root}scripts/${script}`, ...args], { encoding: "utf8" });

  it("vocab:stats: 統計を表示して、エラーがなければ、終了コード 0(警告がなければ、その旨)", () => {
    const result = run("vocab-stats.mjs");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /エンジニア/);
    assert.match(result.stdout, /警告も、ありません/);
    assert.match(result.stdout, /エラーは、ありません/);
  });

  it("vocab:review --check: 一致していれば、終了コード 0", () => {
    const result = run("vocab-review.mjs", ["--check"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /最新です/);
  });

  it("npm のスクリプトが、登録されている", () => {
    const scripts = JSON.parse(readFileSync(`${root}package.json`, "utf8")).scripts;
    assert.equal(scripts["vocab:stats"], "node scripts/vocab-stats.mjs");
    assert.equal(scripts["vocab:review"], "node scripts/vocab-review.mjs");
  });
});
