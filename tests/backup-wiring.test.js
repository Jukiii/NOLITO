// 記録の書き出し・読み込み(Phase 19 PR 1)の、画面(HTML・view.js)と main.js のつなぎのテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const html = read("public/games/escape-boss/index.html");
const view = read("public/assets/js/games/escape-boss/view.js");
const main = read("public/assets/js/games/escape-boss/main.js");

describe("記録の書き出し・読み込みの HTML", () => {
  it("書き出しのボタン・読み込みのファイル欄・結果の表示欄がある", () => {
    for (const hook of [
      "data-backup-export",
      "data-backup-import",
      "data-backup-status",
      "data-backup-import-message",
      "data-backup-import-confirm",
    ]) {
      assert.ok(html.includes(hook), hook);
    }
  });

  it('読み込みは <input type="file" accept="application/json">', () => {
    const start = html.indexOf("data-backup-import");
    const tag = html.slice(html.lastIndexOf("<input", start), html.indexOf(">", start) + 1);
    assert.match(tag, /type="file"/);
    assert.match(tag, /accept="application\/json"/);
  });

  it("読み込みは、確認のダイアログ(取り消せないことを伝える)を経由する", () => {
    assert.match(html, /<dialog class="modal" id="backup-import-dialog"/);
    assert.match(html, /取り消せません/);
    assert.match(html, /data-modal-close/);
  });
});

describe("view.js のつなぎ", () => {
  it("bind は、onBackupExport・onBackupImport を受け取る", () => {
    assert.match(view, /onBackupExport,\s*onBackupImport,/);
  });

  it("書き出しボタンは、結果の文をそのまま表示欄に出す", () => {
    assert.match(
      view,
      /\$\("\[data-backup-export\]"\)\.addEventListener\("click", \(\) => \{\s*showBackupStatus\(onBackupExport\(\)\.message\);/,
    );
  });

  it("ファイルを選ぶと、1MBを超えるものは断り、それ以外は確認ダイアログを開く(即座には取り込まない)", () => {
    const start = view.indexOf('$("[data-backup-import]").addEventListener("change"');
    const fn = view.slice(start, view.indexOf('$("[data-backup-import-confirm]")'));
    assert.match(fn, /file\.size > MAX_IMPORT_BYTES/);
    assert.match(fn, /showModal\(\)/);
    assert.ok(!/onBackupImport\(/.test(fn), "ダイアログを開く前に取り込んでいない");
  });

  it("確認ダイアログの「置き換える」を押したときだけ、取り込みを実行する", () => {
    const start = view.indexOf('$("[data-backup-import-confirm]")');
    const fn = view.slice(start, view.indexOf('$("[data-retry]")', start));
    assert.match(fn, /onBackupImport\(pendingImportText\)/);
  });

  it("MAX_IMPORT_BYTES は storage.js から取り込む(サイズの基準を重複させない)", () => {
    assert.match(view, /import \{ MAX_IMPORT_BYTES \} from "\.\/storage\.js";/);
  });

  it("文字は textContent 相当(el()・setText・showBackupStatus)だけで入れる", () => {
    const fn = view.slice(
      view.indexOf("const showBackupStatus"),
      view.indexOf("const showBackupStatus") + 200,
    );
    assert.match(fn, /\.textContent = message;/);
    assert.ok(!/innerHTML/.test(fn));
  });
});

describe("main.js のつなぎ", () => {
  it("exportBackup は、store.exportJson() を、ファイルとして書き出す(ダウンロード)", () => {
    const fn = main.slice(
      main.indexOf("function exportBackup"),
      main.indexOf("function importBackup"),
    );
    assert.match(fn, /store\.exportJson\(\)/);
    assert.match(fn, /download\(`escape-boss-\$\{dateStamp\(\)\}\.json`/);
    assert.match(fn, /if \(json === null\)/);
  });

  it("importBackup は、store.importJson を呼び、成功したら refreshDashboard する", () => {
    const start = main.indexOf("function importBackup");
    const fn = main.slice(start, main.indexOf("\n}\n", start) + 2);
    assert.match(fn, /store\.importJson\(text\)/);
    assert.match(fn, /refreshDashboard\(\);/);
    assert.match(fn, /BACKUP_IMPORT_ERRORS\[result\.error\]/);
  });

  it("download は、Blob・URL.createObjectURL を使い、あとで revokeObjectURL する", () => {
    const fn = main.slice(main.indexOf("function download"), main.indexOf("const dateStamp"));
    assert.match(fn, /new Blob\(\[text\], \{ type: mime \}\)/);
    assert.match(fn, /URL\.createObjectURL/);
    assert.match(fn, /URL\.revokeObjectURL/);
  });
});
