// 語録の原稿から公開の JSON を作る処理(Phase 14 PR 1)のテスト。
// 実際の原稿・生成物・コマンド・文書との一致も検査する。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createMatcher } from "../public/assets/js/games/escape-boss/romaji.js";
import {
  buildOutputs,
  checkOutputs,
  loadContext,
  loadSources,
  readSources,
  renderPublished,
  writeOutputs,
} from "../scripts/lib/vocab-build.mjs";
import { parseVocabularyMarkdown, stringifyVocabularyMarkdown } from "../scripts/lib/vocab-md.mjs";
import { PUBLISHED_KEYS, validateVocabulary } from "../scripts/lib/vocab-validate.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const context = loadContext(root);

// ---- 実際の原稿と生成物 ----
describe("実際の原稿 → 公開の JSON", () => {
  it("原稿の検証を通る(エラーが 1 件もない)", async () => {
    const { errors } = await buildOutputs(loadSources(root), context);
    assert.deepEqual(errors, []);
  });

  it("生成物(コミットされた JSON)が、原稿から作ったものと、まったく同じ(最新である)", async () => {
    const { outputs, errors } = await buildOutputs(loadSources(root), context);
    assert.deepEqual(errors, []);
    assert.equal(outputs.size, 6);
    assert.deepEqual(checkOutputs(root, outputs), []);
  });

  it("公開の JSON に、原稿だけの項目(review・draft・note)が、入っていない。項目の順序が決まっている", () => {
    for (const job of context.jobs) {
      const text = read(`public/data/vocabulary/${job.id}.json`);
      assert.ok(!/"(review|draft|note)"/.test(text), job.id);
      const data = JSON.parse(text);
      // detail(詳細説明)・difficulties(難易度専用)は、ある語だけ、決まった位置に入る
      for (const item of data.items) {
        const expected = PUBLISHED_KEYS.filter(
          (key) => !["detail", "difficulties"].includes(key) || key in item,
        );
        assert.deepEqual(Object.keys(item), expected, item.id);
      }
    }
  });

  it("公開している語は 180 語。原稿の語(下書きを除く)と、一対一で対応する", async () => {
    const { files } = await buildOutputs(loadSources(root), context);
    let total = 0;
    for (const { data } of files) {
      const published = JSON.parse(read(`public/data/vocabulary/${data.job_id}.json`));
      const expected = data.items.filter((item) => !item.draft).map((item) => item.id);
      assert.deepEqual(
        published.items.map((item) => item.id),
        expected,
        data.job_id,
      );
      total += published.items.length;
    }
    assert.equal(total, 180);
  });

  it("詳細説明(detail)のある語は 6 語(職種ごとに 1 語。難易度 3)。学習ポイントを持ち、確認メモがついている", async () => {
    const { files } = await buildOutputs(loadSources(root), context);
    const detailed = files.flatMap(({ data }) => data.items.filter((item) => item.detail));
    assert.deepEqual(
      detailed.map((item) => item.id),
      ["engineer-010", "food-service-029", "office-008", "retail-011", "sales-010", "teaching-029"],
    );
    for (const item of detailed) {
      assert.equal(item.difficulty, 3, item.id);
      assert.ok(item.learning_points.length >= 2, item.id);
      assert.ok(item.note.includes("AI の下書き"), item.id);
      assert.equal(item.review, "pending", item.id);
    }
    // 公開の JSON にも、同じ 6 語だけが、detail を持つ
    let published = 0;
    for (const job of context.jobs) {
      const data = JSON.parse(read(`public/data/vocabulary/${job.id}.json`));
      published += data.items.filter((item) => "detail" in item).length;
    }
    assert.equal(published, 6);
  });

  it("原稿の確認メモ(note)は、41 件(以前の 35 件 + 詳細説明の見本 6 件)。すべて実在する語についている", async () => {
    const { files } = await buildOutputs(loadSources(root), context);
    const noted = files.flatMap(({ data }) => data.items.filter((item) => item.note));
    assert.equal(noted.length, 41);
    for (const item of noted) assert.ok(Array.from(item.note).length <= 200, item.id);
  });

  it("既存の語は、すべて review: pending(人間の確認は、まだ。確認できたら、confirmed にする)", async () => {
    const { files } = await buildOutputs(loadSources(root), context);
    for (const { data } of files) {
      for (const item of data.items) assert.equal(item.review, "pending", item.id);
    }
  });
});

// ---- 合成した原稿 ----
const ROLES = context.roleIds;
const DIFFICULTIES = context.difficultyIds;
const mkJob = (id, name) => ({ id, name });
const word = (jobId, n, overrides = {}) => ({
  id: `${jobId}-${String(n).padStart(3, "0")}`,
  japanese: `${jobId}語${n}`,
  reading: ["ばぐ", "こーど", "ろぐ", "てすと", "ぶらんち"][n - 1] ?? "あいう",
  category: "開発",
  difficulty: 1,
  roles: ROLES,
  explanation: `語${n}の説明。`,
  ...overrides,
});
const manuscript = (jobId, name, items, meta = {}) =>
  stringifyVocabularyMarkdown(
    {
      job_id: jobId,
      job_name: name,
      version: "1.0.0",
      updated_at: "2026-09-21",
      items: items.map((item) => ({
        related_terms: [],
        learning_points: [],
        weak_detection: { enabled: true },
        romaji: ["x"],
        ...item,
      })),
      ...meta,
    },
    { intro: `# ${name}` },
  ).replace(/ {4}romaji: \[x\]\n/g, "");
const source = (name, text) => ({
  name,
  file: `content/vocabulary/${name}.md`,
  text,
  kind: "base",
});
// 拡張ファイル(Phase 24): job_id と items だけの、軽い原稿。JSON は、正しい YAML でもある
const extSource = (name, tag, items, overrides = {}) => ({
  name,
  file: `content/vocabulary/${name}.ext-${tag}.md`,
  kind: "ext",
  text: `\`\`\`yaml\n${JSON.stringify({ job_id: name, items, ...overrides }, null, 2)}\n\`\`\`\n`,
});
const demoContext = { jobs: [mkJob("demo", "デモ")], roleIds: ROLES, difficultyIds: DIFFICULTIES };

describe("合成した原稿", () => {
  it("下書きは公開しない。ローマ字は自動で作られる。原稿だけの項目は入らない", async () => {
    const text = manuscript("demo", "デモ", [
      word("demo", 1, { review: "confirmed", note: "メモ" }),
      word("demo", 2, { draft: true }),
      word("demo", 3),
    ]);
    const { outputs, errors, files } = await buildOutputs([source("demo", text)], demoContext);
    assert.deepEqual(errors, []);
    const json = JSON.parse(outputs.get("public/data/vocabulary/demo.json"));
    assert.deepEqual(
      json.items.map((item) => item.id),
      ["demo-001", "demo-003"],
    );
    assert.deepEqual(json.items[0].romaji, ["bagu"]);
    assert.ok(!JSON.stringify(json).includes("メモ"));
    assert.equal(files[0].data.items.length, 3);
    // 読み取り → 検証 → 生成の順序が、決まっている
    assert.deepEqual(Object.keys(json), ["job_id", "job_name", "version", "updated_at", "items"]);
  });

  it("生成した JSON の、ローマ字の候補は、すべて入力できる(標準の表記が先頭)", async () => {
    const { outputs } = await buildOutputs(
      [
        source(
          "demo",
          manuscript("demo", "デモ", [word("demo", 1), word("demo", 2), word("demo", 4)]),
        ),
      ],
      demoContext,
    );
    for (const item of JSON.parse(outputs.get("public/data/vocabulary/demo.json")).items) {
      assert.equal(item.romaji[0], createMatcher(item.reading).canonical);
      for (const candidate of item.romaji) {
        const matcher = createMatcher(item.reading);
        for (const char of candidate) assert.notEqual(matcher.input(char), "miss");
        assert.ok(matcher.done);
      }
    }
  });

  it("問題があれば、outputs は空で、すべての問題が、ファイル名つきで返る", async () => {
    const bad = manuscript("demo", "デモ", [
      word("demo", 1, { difficulty: 9 }),
      word("demo", 2, { explanation: "句点なし" }),
    ]);
    const { outputs, errors } = await buildOutputs([source("demo", bad)], demoContext);
    assert.equal(outputs.size, 0);
    assert.ok(errors.length >= 2);
    assert.ok(errors.every((line) => line.startsWith("content/vocabulary/demo.md: ")));
  });

  it("YAML の読み取りに失敗した原稿は、その旨を返し、ほかの原稿の検証は、続ける", async () => {
    const context2 = { jobs: [mkJob("demo", "デモ"), mkJob("other", "別")], roleIds: ROLES };
    const { errors } = await buildOutputs(
      [
        source("demo", "# YAML なし"),
        source("other", manuscript("other", "別", [word("other", 1, { difficulty: 9 })])),
      ],
      context2,
    );
    assert.ok(errors.some((line) => line.includes("demo.md: ```yaml")));
    assert.ok(errors.some((line) => line.includes("other.md") && line.includes("difficulty")));
  });

  it("ファイル名と job_id が違う・原稿がない職種がある・職種をまたぐ重複は、エラー", async () => {
    const wrongName = manuscript("demo", "デモ", [word("demo", 1)]);
    const r1 = await buildOutputs([source("misnamed", wrongName)], demoContext);
    assert.ok(r1.errors.some((line) => line.includes("そろえてください")));
    assert.ok(r1.errors.some((line) => line.includes("demo.md: 職種 demo の原稿がありません")));

    const context2 = { jobs: [mkJob("a", "甲"), mkJob("b", "乙")], roleIds: ROLES };
    const dup = await buildOutputs(
      [
        source("a", manuscript("a", "甲", [word("a", 1, { japanese: "同じ語" })])),
        source("b", manuscript("b", "乙", [word("b", 1, { japanese: "同じ語" })])),
      ],
      context2,
    );
    assert.ok(dup.errors.some((line) => line.includes("日本語の表記が")));
  });

  it("下書きの語は、公開の語に、指されない(関連用語)。下書きの中の誤りも、エラーにする", async () => {
    const text = manuscript("demo", "デモ", [
      word("demo", 1, { related_terms: ["demo語2"] }),
      word("demo", 2, { draft: true }),
    ]);
    const { errors } = await buildOutputs([source("demo", text)], demoContext);
    assert.ok(errors.some((line) => line.includes("下書きです")));
    const brokenDraft = manuscript("demo", "デモ", [
      word("demo", 1),
      word("demo", 2, { draft: true, difficulty: 99 }),
    ]);
    const r = await buildOutputs([source("demo", brokenDraft)], demoContext);
    assert.ok(r.errors.some((line) => line.includes("difficulty")));
  });

  it("同じ原稿からは、いつも同じ JSON(決まった出力)。CRLF の原稿でも、同じ", async () => {
    const text = manuscript("demo", "デモ", [word("demo", 1), word("demo", 2)]);
    const a = await buildOutputs([source("demo", text)], demoContext);
    const b = await buildOutputs([source("demo", text)], demoContext);
    assert.deepEqual([...a.outputs], [...b.outputs]);
    const crlf = await buildOutputs([source("demo", text.replaceAll("\n", "\r\n"))], demoContext);
    assert.deepEqual([...a.outputs], [...crlf.outputs]);
  });

  it("JSON の整形は Prettier(短い一覧は 1 行)。末尾は改行 1 つ", async () => {
    const { files } = readSources(
      [source("demo", manuscript("demo", "デモ", [word("demo", 1)]))],
      demoContext,
    );
    const text = await renderPublished(files[0].data);
    assert.match(text, /"roles": \["senpai", "kakaricho", "buchou", "shachou", "kaicho"\]/);
    assert.ok(text.endsWith("}\n") && !text.endsWith("\n\n"));
  });
});

describe("拡張ファイル(役職・難易度の専用語を足す。Phase 24)", () => {
  it("ベース + 拡張ファイルの items を、マージしてから検証する(ベースが先、拡張はあとに続く)", async () => {
    const base = source("demo", manuscript("demo", "デモ", [word("demo", 1), word("demo", 2)]));
    const ext = extSource("demo", "kaicho", [word("demo", 3, { roles: ["kaicho"] })]);
    const { outputs, errors, files } = await buildOutputs([base, ext], demoContext);
    assert.deepEqual(errors, []);
    assert.equal(files.length, 1, "職種数は、拡張ファイルがあっても、1 のまま");
    const json = JSON.parse(outputs.get("public/data/vocabulary/demo.json"));
    assert.deepEqual(
      json.items.map((item) => item.id),
      ["demo-001", "demo-002", "demo-003"],
    );
    assert.deepEqual(json.items[2].roles, ["kaicho"]);
  });

  it("拡張ファイルは、複数あってよい(名前が違えば)。順は、渡した順のまま追加される", async () => {
    const base = source("demo", manuscript("demo", "デモ", [word("demo", 1)]));
    const ext1 = extSource("demo", "kaicho", [word("demo", 2, { roles: ["kaicho"] })]);
    const ext2 = extSource("demo", "hard", [word("demo", 3, { difficulties: ["hard"] })]);
    const { outputs, errors } = await buildOutputs([base, ext1, ext2], demoContext);
    assert.deepEqual(errors, []);
    const json = JSON.parse(outputs.get("public/data/vocabulary/demo.json"));
    assert.deepEqual(
      json.items.map((item) => item.id),
      ["demo-001", "demo-002", "demo-003"],
    );
    assert.deepEqual(json.items[2].difficulties, ["hard"]);
  });

  it("拡張ファイルの語は、ベースの語(同じ職種)を関連用語にできる", async () => {
    const base = source("demo", manuscript("demo", "デモ", [word("demo", 1)]));
    const ext = extSource("demo", "kaicho", [
      word("demo", 2, { roles: ["kaicho"], related_terms: [`demo語1`] }),
    ]);
    const { errors } = await buildOutputs([base, ext], demoContext);
    assert.deepEqual(errors, []);
  });

  it("id・日本語・読みの重複は、ベースと拡張ファイルをまたいでも、検査される", async () => {
    const base = source("demo", manuscript("demo", "デモ", [word("demo", 1)]));
    const dupId = await buildOutputs(
      [base, extSource("demo", "x", [word("demo", 1, { japanese: "別の語" })])],
      demoContext,
    );
    assert.ok(dupId.errors.some((line) => line.includes("id が重複しています")));

    const dupJapanese = await buildOutputs(
      [base, extSource("demo", "x", [word("demo", 2, { japanese: word("demo", 1).japanese })])],
      demoContext,
    );
    assert.ok(dupJapanese.errors.some((line) => line.includes("日本語の表記が重複しています")));

    const dupReading = await buildOutputs(
      [base, extSource("demo", "x", [word("demo", 2, { reading: word("demo", 1).reading })])],
      demoContext,
    );
    assert.ok(dupReading.errors.some((line) => line.includes("読みが重複しています")));
  });

  it("拡張ファイルには job_id と items だけ。ほかの項目(job_name 等)は、エラー", async () => {
    const base = source("demo", manuscript("demo", "デモ", [word("demo", 1)]));
    const ext = extSource("demo", "x", [word("demo", 2)], { job_name: "デモ" });
    const { errors } = await buildOutputs([base, ext], demoContext);
    assert.ok(
      errors.some((line) => line.includes("job_id と items だけ")),
      errors.join("\n"),
    );
  });

  it("拡張ファイルの job_id が、ファイル名(対応するベース)と違えば、エラー", async () => {
    const base = source("demo", manuscript("demo", "デモ", [word("demo", 1)]));
    const ext = { ...extSource("demo", "x", [word("other", 2)]) };
    ext.text = ext.text.replace('"job_id": "demo"', '"job_id": "other"');
    const { errors } = await buildOutputs([base, ext], demoContext);
    assert.ok(
      errors.some((line) => line.includes("ベースの原稿と同じ")),
      errors.join("\n"),
    );
  });

  it("拡張ファイルの items が、空・配列でなければ、エラー", async () => {
    const base = source("demo", manuscript("demo", "デモ", [word("demo", 1)]));
    const ext = extSource("demo", "x", []);
    const { errors } = await buildOutputs([base, ext], demoContext);
    assert.ok(
      errors.some((line) => line.includes("items は、語の一覧")),
      errors.join("\n"),
    );
  });

  it("対応するベースの原稿がない拡張ファイルは、エラー(単独では検証できない)", async () => {
    const ext = extSource("demo", "x", [word("demo", 1)]);
    const { errors } = await buildOutputs([ext], demoContext);
    assert.ok(
      errors.some((line) => line.includes("対応するベースの原稿")),
      errors.join("\n"),
    );
  });
});

describe("最新かの検査(checkOutputs)・書き出し", () => {
  const tempRoot = () => {
    const dir = mkdtempSync(join(tmpdir(), "nolito-vocab-"));
    mkdirSync(join(dir, "public/data/vocabulary"), { recursive: true });
    return dir;
  };

  it("書き出したものは、最新。書き換えられたもの・ないもの・原稿にない JSON は、違いとして返る", async () => {
    const dir = tempRoot();
    try {
      const { outputs } = await buildOutputs(
        [source("demo", manuscript("demo", "デモ", [word("demo", 1)]))],
        demoContext,
      );
      assert.deepEqual(checkOutputs(dir, outputs), [
        "public/data/vocabulary/demo.json がありません",
      ]);
      writeOutputs(dir, outputs);
      assert.deepEqual(checkOutputs(dir, outputs), []);

      writeFileSync(join(dir, "public/data/vocabulary/demo.json"), "{}\n");
      assert.match(checkOutputs(dir, outputs)[0], /原稿と違います/);
      writeOutputs(dir, outputs);

      writeFileSync(join(dir, "public/data/vocabulary/stale.json"), "{}\n");
      assert.match(checkOutputs(dir, outputs)[0], /stale\.json に、対応する原稿がありません/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("原稿の読み込み(loadSources)", () => {
  it("content/vocabulary/*.md を、名前順に読む(ファイル名が、職種の id)。いまは、すべてベース(拡張ファイルは、まだない)", () => {
    const sources = loadSources(root);
    assert.deepEqual(
      sources.map((entry) => entry.name),
      ["engineer", "food-service", "office", "retail", "sales", "teaching"],
    );
    for (const entry of sources) {
      assert.ok(!entry.text.includes("\r"), entry.name);
      assert.equal(entry.kind, "base", entry.name);
    }
  });

  it("フォルダがなければ、空", () => {
    assert.deepEqual(loadSources(join(tmpdir(), "nolito-none-xyz")), []);
  });

  it("<職種ID>.ext-<名前>.md は、拡張ファイル(kind: ext)として、職種IDを取り出す", () => {
    const dir = mkdtempSync(join(tmpdir(), "nolito-vocab-src-"));
    try {
      const srcDir = join(dir, "content/vocabulary");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "engineer.md"), "base");
      writeFileSync(join(srcDir, "engineer.ext-kaicho.md"), "ext1");
      writeFileSync(join(srcDir, "food-service.ext-hard-words.md"), "ext2");
      const sources = loadSources(dir);
      assert.deepEqual(
        sources.map(({ name, kind }) => `${name}:${kind}`),
        ["engineer:ext", "engineer:base", "food-service:ext"],
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("コマンド", () => {
  const run = (script, args = []) =>
    spawnSync(process.execPath, [`${root}scripts/${script}`, ...args], { encoding: "utf8" });

  it("build:vocabulary --check: 最新なら、終了コード 0(職種数・公開の語数・下書きの数を出す)", () => {
    const result = run("build-vocabulary.mjs", ["--check"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /最新です\(6 職種・公開 180 語\(下書き 0 語は、公開しません\)\)/);
  });

  it("vocab:check: 検証の結果・確認の状況・確認メモを出して、終了コード 0", () => {
    const result = run("vocab-check.mjs");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /公開 180 語\(確認済み 0 語・未確認 180 語\)/);
    assert.match(result.stdout, /形式の検証.*通りました/);
    assert.match(result.stdout, /人間に見てほしい点\(note\): 41 件/);
    assert.match(result.stdout, /engineer-009\(プルリクエスト\)/);
  });

  it("vocab:check --for-ai: 指示・機械の確認結果・確認する語の順で出す。下書きがなければ、その旨", () => {
    const result = run("vocab-check.mjs", ["--for-ai"]);
    assert.equal(result.status, 0, result.stderr);
    const out = result.stdout;
    assert.ok(out.indexOf("AIチェック用プロンプト") < out.indexOf("機械の確認結果"));
    assert.ok(out.indexOf("機械の確認結果") < out.indexOf("確認する語"));
    assert.match(out, /確認する語が、ありません/);
    assert.match(out, /最終判断は、人間が行います/);
  });

  it("vocab:check --for-ai --all: 未確認の語も、YAML で出す(読み取れる形)", () => {
    const result = run("vocab-check.mjs", ["--for-ai", "--all"]);
    assert.equal(result.status, 0, result.stderr);
    const blocks = [...result.stdout.matchAll(/```yaml\n([\s\S]*?)\n```/g)];
    assert.equal(blocks.length, 6);
    const data = parseVocabularyMarkdown(`\`\`\`yaml\n${blocks[0][1]}\n\`\`\``);
    assert.equal(data.job_id, "engineer");
    assert.equal(data.items.length, 30);
  });

  it("vocab:check --improve: 改善提案用プロンプト・候補の件数・語を、YAML で出す(Phase 25)", () => {
    const result = run("vocab-check.mjs", ["--improve"]);
    assert.equal(result.status, 0, result.stderr);
    const out = result.stdout;
    assert.ok(out.indexOf("AI改善提案用プロンプト") < out.indexOf("改善の候補"));
    assert.match(out, /改善の候補\(公開済み・関連用語が、まだない語\): 68 件/);
    assert.match(
      out,
      /AI の提案は、参考です。最終判断は、人間が行います。原稿は、AIが直接書き換えません。/,
    );
    const blocks = [...out.matchAll(/```yaml\n([\s\S]*?)\n```/g)];
    assert.ok(blocks.length >= 1);
    const data = parseVocabularyMarkdown(`\`\`\`yaml\n${blocks[0][1]}\n\`\`\``);
    assert.ok(data.items.every((item) => (item.related_terms ?? []).length === 0));
  });

  it("vocab:stats: 確認の状況も出す", () => {
    const result = run("vocab-stats.mjs");
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /人間の確認: 確認済み 0 語 \/ 未確認 180 語\(公開 180 語\)。下書き 0 語/,
    );
  });

  it("npm のスクリプトが、登録されている。build は、語録も作る", () => {
    const scripts = JSON.parse(read("package.json")).scripts;
    assert.equal(scripts["build:vocabulary"], "node scripts/build-vocabulary.mjs");
    assert.equal(scripts["vocab:check"], "node scripts/vocab-check.mjs");
    assert.ok(scripts.build.includes("npm run build:vocabulary"));
  });
});

describe("文書との一致", () => {
  const template = read("docs/04_templates/vocabulary-template.md");

  it("テンプレートの YAML の見本は、検証を通る(見本が、古くならない)", () => {
    const raw = parseVocabularyMarkdown(template);
    const { errors, data } = validateVocabulary(raw, {
      jobs: [{ id: "engineer", name: "エンジニア" }],
      roleIds: ROLES,
      difficultyIds: context.difficultyIds,
    });
    assert.deepEqual(errors, []);
    assert.equal(data.items[0].draft, true);
    assert.equal(data.items[0].review, "pending");
  });

  it("テンプレートの項目の表に、公開の項目・原稿だけの項目が、すべて載っている", () => {
    for (const key of [
      ...PUBLISHED_KEYS,
      "review",
      "draft",
      "note",
      "job_id",
      "job_name",
      "version",
      "updated_at",
      "items",
    ]) {
      assert.ok(template.includes(`\`${key}\``), key);
    }
  });

  it("流れの文書に、コマンドが載っている(開発の手順・AI 用プロンプト・チェックリスト)", () => {
    const setup = read("docs/dev-setup.md");
    for (const text of [
      "npm run build:vocabulary",
      "npm run vocab:check",
      "--for-ai",
      "npm run vocab:review",
      "draft: true",
    ]) {
      assert.ok(setup.includes(text), text);
    }
    assert.match(read("docs/06_ai/vocabulary-generation-prompt.md"), /draft: true/);
    assert.match(read("docs/06_ai/vocabulary-generation-prompt.md"), /romaji.*書かない/);
    assert.match(
      read("docs/06_ai/content-check-prompt.md"),
      /最終判断にせず、人間による最終確認を必須/,
    );
    assert.match(read("docs/05_checklists/vocabulary-validation.md"), /人間が最終確認する/);
  });

  it("原稿は、YAML の項目の順序・書き方の説明(intro)を持ち、管理元であることを書いている", () => {
    for (const job of context.jobs) {
      const text = read(`content/vocabulary/${job.id}.md`);
      assert.ok(text.includes("管理元"), job.id);
      assert.ok(text.includes("npm run build:vocabulary"), job.id);
    }
  });
});

describe("検証の文脈(loadContext)", () => {
  it("jobs.json の 6 職種と、roles.json の 5 役職・difficulties.json の 3 難易度", () => {
    assert.equal(context.jobs.length, 6);
    assert.deepEqual(context.roleIds, ["senpai", "kakaricho", "buchou", "shachou", "kaicho"]);
    assert.deepEqual(context.difficultyIds, ["easy", "normal", "hard"]);
    void validateVocabulary;
  });
});
