// 問い合わせを、運営者が読む・対応済みにする・削除する、スクリプトのテスト(Phase 10 PR 3)。本物の D1 には、通信しない。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { storeInquiry } from "../functions/_lib/contact.js";
import {
  ID_PATTERN,
  RETENTION_DAYS,
  formatInquiry,
  listSql,
  markDoneSql,
  parseExecuteJson,
  purgeCountSql,
  purgeSql,
  safeText,
  validateId,
} from "../scripts/lib/inquiries.mjs";
import { createDb } from "./helpers/d1.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const NOW = 1_800_000_000;
const DAY = 24 * 60 * 60;
const REAL_ID = "0b1c2d3e-4f50-4162-8394-a5b6c7d8e9f0";

const rows = async (db, sql) => (await db.prepare(sql).all()).results;
const inquiry = (overrides = {}) => ({
  category: "bug",
  product: "kii-michi",
  message: "練習モードの、不具合の報告です。",
  email: "",
  envInfo: "",
  ...overrides,
});

async function seed(db) {
  const ids = {};
  ids.newer = await storeInquiry(db, inquiry({ message: "新しい未対応" }), NOW - DAY);
  ids.older = await storeInquiry(
    db,
    inquiry({ message: "古い未対応", category: "request" }),
    NOW - 5 * DAY,
  );
  ids.doneOld = await storeInquiry(db, inquiry({ message: "古い対応済み" }), NOW - 400 * DAY);
  ids.doneRecent = await storeInquiry(db, inquiry({ message: "最近の対応済み" }), NOW - 10 * DAY);
  await db
    .prepare("UPDATE inquiries SET status = 'done', resolved_at = ? WHERE id = ?")
    .bind(NOW - 200 * DAY, ids.doneOld)
    .run();
  await db
    .prepare("UPDATE inquiries SET status = 'done', resolved_at = ? WHERE id = ?")
    .bind(NOW - 3 * DAY, ids.doneRecent)
    .run();
  return ids;
}

describe("SQL(本物と同じ SQLite で、実行して確かめる)", () => {
  it("一覧: 既定は、未対応だけを新しい順。--all なら、対応済みも", async () => {
    const db = createDb();
    await seed(db);
    const unresolved = await rows(db, listSql());
    assert.deepEqual(
      unresolved.map((row) => row.message),
      ["新しい未対応", "古い未対応"],
    );
    const all = await rows(db, listSql({ all: true }));
    assert.equal(all.length, 4);
    assert.ok(all.every((row, i) => i === 0 || all[i - 1].created_at >= row.created_at));
  });

  it("対応済みにする: 未対応のものだけが変わり、時刻が入る。二度実行しても、時刻は、変わらない", async () => {
    const db = createDb();
    const ids = await seed(db);
    await db.prepare(markDoneSql(ids.newer, NOW)).run();
    let [row] = await rows(
      db,
      `SELECT status, resolved_at FROM inquiries WHERE id = '${ids.newer}'`,
    );
    assert.deepEqual(row, { status: "done", resolved_at: NOW });
    await db.prepare(markDoneSql(ids.newer, NOW + 999)).run();
    [row] = await rows(db, `SELECT status, resolved_at FROM inquiries WHERE id = '${ids.newer}'`);
    assert.equal(row.resolved_at, NOW);
    // ほかは、変わらない
    assert.equal((await rows(db, "SELECT * FROM inquiries WHERE status = 'new'")).length, 1);
  });

  it("削除: 対応済みで、180 日以上たったものだけ。未対応・最近のものは、残る", async () => {
    const db = createDb();
    const ids = await seed(db);
    assert.equal(RETENTION_DAYS, 180);
    assert.deepEqual(await rows(db, purgeCountSql(NOW)), [{ n: 1 }]);
    await db.prepare(purgeSql(NOW)).run();
    const left = (await rows(db, "SELECT id FROM inquiries")).map((row) => row.id).sort();
    assert.deepEqual(left, [ids.newer, ids.older, ids.doneRecent].sort());
    assert.deepEqual(await rows(db, purgeCountSql(NOW)), [{ n: 0 }]);
  });

  it("未対応のものは、どれだけ古くても、削除されない(対応していないものを、消さない)", async () => {
    const db = createDb();
    await storeInquiry(db, inquiry(), NOW - 1000 * DAY);
    await db.prepare(purgeSql(NOW)).run();
    assert.equal((await rows(db, "SELECT * FROM inquiries")).length, 1);
  });
});

describe("入力の検査(SQL に入れる値)", () => {
  it("問い合わせの ID は、決まった形だけ(SQL インジェクションを防ぐ)", async () => {
    const good = "AbCdEfGhIjKlMnOpQrSt12";
    assert.equal(validateId(good), good);
    assert.match(good, ID_PATTERN);
    for (const bad of [
      "",
      "short",
      "x'; DROP TABLE inquiries; --",
      `${good}'`,
      `${good} `,
      "a".repeat(33),
      undefined,
      null,
      123,
    ]) {
      assert.throws(() => validateId(bad), /ID の形/, String(bad));
      assert.throws(() => markDoneSql(bad, NOW), /ID の形/);
    }
  });

  it("時刻・日数は、非負の整数だけ", () => {
    for (const bad of [-1, 1.5, NaN, "1", undefined, null]) {
      assert.throws(() => markDoneSql("AbCdEfGhIjKlMnOpQrSt12", bad), /不正/);
      assert.throws(() => purgeSql(bad), /不正/);
      // 日数の undefined は、既定値(180)になるので、対象外
      if (bad !== undefined) assert.throws(() => purgeCountSql(NOW, bad), /不正/);
    }
  });

  it("サーバーが作る ID は、この検査を通る", async () => {
    const db = createDb();
    const id = await storeInquiry(db, inquiry(), NOW);
    assert.match(id, ID_PATTERN);
  });
});

describe("表示(外の人が書いた内容を、端末に出す)", () => {
  it("制御文字(端末の操作文字)・双方向制御文字を「?」に置き換える。改行・タブは残す", () => {
    const esc = String.fromCodePoint(0x1b);
    const rlo = String.fromCodePoint(0x202e);
    const bell = String.fromCodePoint(0x07);
    const c1 = String.fromCodePoint(0x9b); // C1 の CSI
    const result = safeText(`赤${esc}[31m文字${rlo}逆${bell}${c1}2J\n次の行\tタブ`);
    assert.equal(result, "赤?[31m文字?逆??2J\n次の行\tタブ");
    for (const char of result) {
      const code = char.codePointAt(0);
      assert.ok(
        code === 0x0a ||
          code === 0x09 ||
          (code >= 0x20 && code !== 0x7f && !(code >= 0x80 && code <= 0x9f)),
        code.toString(16),
      );
    }
  });

  it("null・undefined・数も、落ちない", () => {
    assert.equal(safeText(null), "");
    assert.equal(safeText(undefined), "");
    assert.equal(safeText(12), "12");
  });

  it("1 件の表示に、種類・日付・プロダクト・ID・返信先・環境・本文が出る。本文は、字下げされる", () => {
    const output = formatInquiry({
      id: "AbCdEfGhIjKlMnOpQrSt12",
      created_at: NOW,
      category: "bug",
      product_id: "kii-michi",
      message: "一行目\n二行目",
      email: "taro@example.com",
      env_info: "viewport=375x800",
      status: "new",
      resolved_at: null,
    });
    for (const word of [
      "[未対応]",
      "不具合の報告",
      "kii-michi",
      "ID: AbCdEfGhIjKlMnOpQrSt12",
      "返信先: taro@example.com",
      "環境: viewport=375x800",
      "  一行目",
      "  二行目",
    ]) {
      assert.ok(output.includes(word), word);
    }
  });

  it("返信先がなければ「(なし)」、プロダクトがなければ「(サイト全体)」。対応済みは、その旨と日が出る", () => {
    const output = formatInquiry({
      id: "AbCdEfGhIjKlMnOpQrSt12",
      created_at: NOW,
      category: "other",
      product_id: "",
      message: "内容",
      email: "",
      env_info: "",
      status: "done",
      resolved_at: NOW + DAY,
    });
    for (const word of [
      "[対応済み]",
      "その他",
      "(サイト全体)",
      "返信先: (なし)",
      "対応済みにした日",
    ]) {
      assert.ok(output.includes(word), word);
    }
    assert.ok(!output.includes("環境:"));
  });

  it("表示に、制御文字が混じらない(本文・メールアドレス・環境・種類・ID のどれからも)", () => {
    const esc = String.fromCodePoint(0x1b);
    const output = formatInquiry({
      id: `id${esc}[0m`,
      created_at: NOW,
      category: `x${esc}`,
      product_id: `p${esc}`,
      message: `m${esc}[2J`,
      email: `e${esc}`,
      env_info: `v${esc}`,
      status: "new",
      resolved_at: null,
    });
    assert.ok(!output.includes(esc));
  });
});

describe("wrangler の出力の読み取り", () => {
  it("前後に、ほかの表示が混じっていても、JSON の結果の行を、取り出す", () => {
    const stdout = `🌀 Executing on remote database nolito:\n[\n  { "results": [ { "id": "a", "n": 1 }, { "id": "b", "n": 2 } ], "success": true } \n]\n`;
    assert.deepEqual(parseExecuteJson(stdout), [
      { id: "a", n: 1 },
      { id: "b", n: 2 },
    ]);
  });

  it("結果がない・複数の文でも、落ちない。JSON でなければ、エラー", () => {
    assert.deepEqual(parseExecuteJson('[{"success":true,"meta":{}}]'), []);
    assert.deepEqual(parseExecuteJson('[{"results":[{"n":1}]},{"results":[{"n":2}]}]'), [
      { n: 1 },
      { n: 2 },
    ]);
    assert.throws(() => parseExecuteJson("エラーです"), /読めませんでした/);
  });
});

describe("コマンド(npm run inquiries)", () => {
  const run = (args = [], env = {}) =>
    spawnSync(process.execPath, [`${root}scripts/inquiries.mjs`, ...args], {
      encoding: "utf8",
      env: { ...process.env, NOLITO_D1_DATABASE_ID: "", ...env },
    });

  it("D1 の ID がなければ、wrangler を呼ぶ前に、エラー終了", () => {
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /NOLITO_D1_DATABASE_ID/);
  });

  it("不正なオプション・組み合わせ・ID は、wrangler を呼ぶ前に、エラー終了", () => {
    for (const args of [
      ["--bogus"],
      ["--yes"],
      ["--purge", "--all"],
      ["--purge", "--done", "x"],
      ["--done", "x'; DROP TABLE inquiries; --"],
      ["--done"],
    ]) {
      const result = run([...args, "--id", REAL_ID]);
      assert.equal(result.status, 1, args.join(" "));
      assert.match(result.stderr, /エラー/);
    }
  });

  it("npm のスクリプトが、登録されている", () => {
    assert.equal(
      JSON.parse(readFileSync(`${root}package.json`, "utf8")).scripts.inquiries,
      "node scripts/inquiries.mjs",
    );
  });

  it("問い合わせを、ファイルに書き出さない・外へ送らない(端末に表示するだけ)", () => {
    const source = ["scripts/inquiries.mjs", "scripts/lib/inquiries.mjs"]
      .map((name) => readFileSync(`${root}${name}`, "utf8").replace(/\/\/.*$/gm, ""))
      .join("\n");
    assert.ok(!/writeFile|appendFile|createWriteStream|fetch\(|https?:\/\//.test(source));
  });
});
