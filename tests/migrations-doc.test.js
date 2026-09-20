// 手順書(docs/auth-setup.md)の「D1 に貼る SQL」が、migrations/ のファイルと、同じ内容であることを守る。
// 手順書の SQL は、D1 の Console が改行を消しても動くように、コメント(--)を抜いてある。
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
// Windows の作業コピーは、改行が CRLF になる(git の設定による)。LF にそろえて読む
const read = (path) => readFileSync(path, "utf8").replaceAll("\r\n", "\n");
const doc = read(`${root}docs/auth-setup.md`);
const migrationsDir = `${root}migrations/`;

// コメントを除き、空白を 1 つにする(比較のための正規化)
const normalize = (sql) =>
  sql
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*,\s*/g, ", ")
    .trim();

const blocks = new Map(
  [...doc.matchAll(/```sql (\d{4}_[a-z_]+\.sql)\n([\s\S]*?)```/g)].map((match) => [
    match[1],
    match[2],
  ]),
);
const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));

describe("手順書の SQL と migrations/", () => {
  it("migrations/ のすべてのファイルが、手順書に載っている(貼り忘れを防ぐ)", () => {
    assert.ok(migrations.length >= 2);
    for (const name of migrations)
      assert.ok(blocks.has(name), `手順書に ${name} の SQL がありません`);
    for (const name of blocks.keys())
      assert.ok(migrations.includes(name), `${name} は migrations/ にありません`);
  });

  it("手順書の SQL は、ファイルと同じ内容(コメントを除く)", () => {
    for (const name of migrations) {
      const file = read(`${migrationsDir}${name}`);
      assert.equal(normalize(blocks.get(name)), normalize(file), name);
    }
  });

  it("手順書の SQL には、コメント(--)がない(1 行になっても動く)", () => {
    for (const [name, sql] of blocks) assert.ok(!sql.includes("--"), name);
  });

  it("番号は、連番で、欠けていない(順番に適用するため)", () => {
    const numbers = migrations.map((name) => Number(name.slice(0, 4))).sort((a, b) => a - b);
    numbers.forEach((number, index) => assert.equal(number, index + 1));
  });

  it("手順書のほかの SQL(運営の操作)にも、コメントがない", () => {
    const all = [...doc.matchAll(/```sql\n([\s\S]*?)```/g)].map((match) => match[1]);
    assert.ok(all.length >= 5);
    for (const sql of all) assert.ok(!sql.includes("--"), sql);
  });
});
