import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  KEYS,
  MAX_CHORDS,
  chordFromEvent,
  chordsEqual,
  describeParseError,
  formatChord,
  formatKeys,
  isImeEvent,
  isValidChord,
  keyLabel,
  parseChord,
  parseKeys,
  reservedReason,
} from "../public/assets/js/tools/kii-michi/keys.js";

const chord = (text) => {
  const result = parseChord(text);
  assert.equal(result.ok, true, text);
  return result.chord;
};
const plain = { ctrl: false, alt: false, shift: false, meta: false };

describe("キー操作の文字の解析", () => {
  it("修飾キーとキーを読む(大文字・小文字・空白は問わない)", () => {
    assert.deepEqual(chord("Ctrl+Shift+P"), { ...plain, ctrl: true, shift: true, key: "p" });
    assert.deepEqual(chord("ctrl+shift+p"), chord("CTRL + SHIFT + P"));
    assert.deepEqual(chord("F5"), { ...plain, key: "F5" });
    assert.deepEqual(chord("f12"), { ...plain, key: "F12" });
    assert.deepEqual(chord("Alt+F4"), { ...plain, alt: true, key: "F4" });
    assert.deepEqual(chord("7"), { ...plain, key: "7" });
  });

  it("別名を読む(Control・Option・Command・Win・記号)", () => {
    assert.deepEqual(chord("Control+A"), chord("Ctrl+A"));
    assert.deepEqual(chord("Option+A"), chord("Alt+A"));
    for (const name of ["Win", "Windows", "Meta", "Cmd", "Command", "⌘", "Super"]) {
      assert.deepEqual(chord(`${name}+D`), { ...plain, meta: true, key: "d" }, name);
    }
    assert.deepEqual(chord("⌃+⌥+⇧+⌘+A"), {
      ctrl: true,
      alt: true,
      shift: true,
      meta: true,
      key: "a",
    });
  });

  it("名前つきのキーと別名(Esc・Return・スペース・矢印・PgUp など)", () => {
    const cases = {
      Esc: "Escape",
      Escape: "Escape",
      Return: "Enter",
      Enter: "Enter",
      Space: "Space",
      スペース: "Space",
      Del: "Delete",
      Bs: "Backspace",
      Ins: "Insert",
      PgUp: "PageUp",
      PageDown: "PageDown",
      Up: "ArrowUp",
      "↓": "ArrowDown",
      Left: "ArrowLeft",
      "→": "ArrowRight",
      Tab: "Tab",
      Home: "Home",
      End: "End",
    };
    for (const [text, key] of Object.entries(cases))
      assert.equal(chord(`Ctrl+${text}`).key, key, text);
  });

  it("記号のキー(, . / ; ' [ ] \\ - = `)を読む。名前(Comma など)でも書ける", () => {
    for (const symbol of ["`", "-", "=", "[", "]", "\\", ";", "'", ",", ".", "/"]) {
      assert.equal(chord(`Ctrl+${symbol}`).key, symbol, symbol);
    }
    assert.equal(chord("Ctrl+Comma").key, ",");
    assert.equal(chord("Ctrl+Slash").key, "/");
    assert.equal(chord("Ctrl+Minus").key, "-");
  });

  it("読めないものは、理由つきで失敗する", () => {
    const cases = [
      ["", "empty"],
      ["   ", "empty"],
      [null, "empty"],
      ["Ctrl", "no-key"],
      ["Ctrl+Shift", "no-key"],
      ["Ctrl++", "bad-plus"],
      ["+A", "bad-plus"],
      ["Ctrl+", "bad-plus"],
      ["Ctrl+Ctrl+A", "duplicate-modifier"],
      ["Ctrl+A+B", "too-many-keys"],
      ["Ctrl+Ω", "unknown-key"],
      ["Ctrl+F13", "unknown-key"],
      ["Ctrl+Foo", "unknown-key"],
      ["Ctrl+AB", "unknown-key"],
      ["Ctrl+あ", "unknown-key"],
    ];
    for (const [input, error] of cases) {
      const result = parseChord(input);
      assert.equal(result.ok, false, String(input));
      assert.equal(result.error, error, String(input));
      assert.ok(describeParseError(result).length > 0);
    }
    assert.match(describeParseError(parseChord("Ctrl+Foo")), /Foo/);
  });
});

describe("順に押すキー操作の解析", () => {
  it("空白で区切った列を読む。→ や全角スペースも区切りにできる", () => {
    const keys = parseKeys("Ctrl+K Ctrl+C").keys;
    assert.deepEqual(keys, [chord("Ctrl+K"), chord("Ctrl+C")]);
    assert.deepEqual(parseKeys("Ctrl+K → Ctrl+C").keys, keys);
    assert.deepEqual(parseKeys(`Ctrl+K${String.fromCharCode(0x3000)}Ctrl+C`).keys, keys);
    assert.deepEqual(parseKeys("  Ctrl+K   Ctrl+C  ").keys, keys);
  });

  it("末尾のカンマは許すが、「Ctrl+,」のカンマは、キーとして読む", () => {
    assert.deepEqual(parseKeys("Ctrl+K, Ctrl+C").keys, [chord("Ctrl+K"), chord("Ctrl+C")]);
    assert.deepEqual(parseKeys("Ctrl+,").keys, [chord("Ctrl+,")]);
    assert.deepEqual(parseKeys("Ctrl+K Ctrl+,").keys, [chord("Ctrl+K"), chord("Ctrl+,")]);
  });

  it("4つまで。空・読めないものは、どの位置かを添えて失敗する", () => {
    assert.equal(MAX_CHORDS, 4);
    assert.equal(parseKeys("A B C D").ok, true);
    assert.equal(parseKeys("A B C D E").error, "too-many-chords");
    assert.equal(parseKeys("").error, "empty");
    assert.equal(parseKeys("→").error, "empty");
    const bad = parseKeys("Ctrl+K Ctrl+Foo");
    assert.equal(bad.ok, false);
    assert.equal(bad.index, 1);
    assert.equal(bad.token, "Foo");
  });
});

describe("表記", () => {
  it("Windows は Ctrl / Alt / Shift / Win、Mac は Control / Option / Shift / Command。順は決まっている", () => {
    const all = { ctrl: true, alt: true, shift: true, meta: true, key: "p" };
    assert.equal(formatChord(all, "windows"), "Ctrl+Alt+Shift+Win+P");
    assert.equal(formatChord(all, "mac"), "Control+Option+Shift+Command+P");
    assert.equal(formatChord({ ...plain, key: "Enter" }), "Enter");
    assert.equal(formatChord({ ...plain, key: "F5" }, "mac"), "F5");
    assert.equal(formatChord(chord("Shift+Ctrl+A")), "Ctrl+Shift+A");
    assert.equal(formatChord(chord("Ctrl+A"), "unknown"), "Ctrl+A");
  });

  it("キーの表示: 英字は大文字・Esc・矢印", () => {
    assert.equal(keyLabel("p"), "P");
    assert.equal(keyLabel("Escape"), "Esc");
    assert.equal(keyLabel("ArrowUp"), "↑");
    assert.equal(keyLabel("5"), "5");
    assert.equal(keyLabel("F5"), "F5");
    assert.equal(keyLabel("/"), "/");
  });

  it("順に押す列は「 → 」でつなぐ", () => {
    assert.equal(formatKeys([chord("Ctrl+K"), chord("Ctrl+C")]), "Ctrl+K → Ctrl+C");
    assert.equal(formatKeys([chord("Command+K")], "mac"), "Command+K");
  });

  it("すべてのキー・修飾キーの組み合わせが、表記から、元のキー操作に戻る(往復)", () => {
    let count = 0;
    for (const key of KEYS) {
      for (let bits = 0; bits < 16; bits += 1) {
        const original = {
          ctrl: !!(bits & 1),
          alt: !!(bits & 2),
          shift: !!(bits & 4),
          meta: !!(bits & 8),
          key,
        };
        for (const os of ["windows", "mac"]) {
          const result = parseChord(formatChord(original, os));
          assert.equal(result.ok, true, `${os} ${formatChord(original, os)}`);
          assert.deepEqual(result.chord, original, `${os} ${formatChord(original, os)}`);
          count += 1;
        }
      }
    }
    assert.ok(count > 2000);
  });
});

describe("検査", () => {
  it("正しい形のキー操作だけを通す", () => {
    assert.equal(isValidChord({ ...plain, key: "a" }), true);
    assert.equal(isValidChord({ ...plain, key: "Enter" }), true);
    for (const bad of [
      null,
      undefined,
      "Ctrl+A",
      [],
      {},
      { ...plain },
      { ...plain, key: "A" },
      { ...plain, key: "Foo" },
      { ...plain, key: "" },
      { ...plain, ctrl: "yes", key: "a" },
      { ctrl: true, alt: false, shift: false, key: "a" },
    ]) {
      assert.equal(isValidChord(bad), false, JSON.stringify(bad));
    }
  });

  it("2つのキー操作が同じか", () => {
    assert.equal(chordsEqual(chord("Ctrl+A"), chord("ctrl+a")), true);
    assert.equal(chordsEqual(chord("Ctrl+A"), chord("Ctrl+Shift+A")), false);
    assert.equal(chordsEqual(chord("Ctrl+A"), chord("Ctrl+B")), false);
  });
});

describe("押したキー(event)の読み取り", () => {
  const event = (code, modifiers = {}) => ({
    code,
    key: "x",
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...modifiers,
  });

  it("位置(code)で読む。Shift を押していても、同じキーになる", () => {
    assert.deepEqual(
      chordFromEvent(event("KeyP", { ctrlKey: true, shiftKey: true, key: "P" })),
      chord("Ctrl+Shift+P"),
    );
    assert.deepEqual(
      chordFromEvent(event("Digit1", { shiftKey: true, key: "!" })),
      chord("Shift+1"),
    );
    assert.deepEqual(chordFromEvent(event("Numpad5")), chord("5"));
    assert.deepEqual(chordFromEvent(event("F5")), chord("F5"));
    assert.deepEqual(chordFromEvent(event("F12", { altKey: true })), chord("Alt+F12"));
  });

  it("名前つきのキー・記号のキー", () => {
    const cases = {
      Enter: "Enter",
      NumpadEnter: "Enter",
      Tab: "Tab",
      Space: "Space",
      Escape: "Escape",
      Backspace: "Backspace",
      Delete: "Delete",
      Insert: "Insert",
      Home: "Home",
      End: "End",
      PageUp: "PageUp",
      PageDown: "PageDown",
      ArrowUp: "ArrowUp",
      ArrowLeft: "ArrowLeft",
      Backquote: "`",
      Minus: "-",
      Equal: "=",
      BracketLeft: "[",
      BracketRight: "]",
      Backslash: "\\",
      IntlYen: "\\",
      Semicolon: ";",
      Quote: "'",
      Comma: ",",
      Period: ".",
      Slash: "/",
    };
    for (const [code, key] of Object.entries(cases)) {
      assert.equal(chordFromEvent(event(code))?.key, key, code);
    }
  });

  it("Meta キー(Win・Command)も読む", () => {
    assert.deepEqual(chordFromEvent(event("KeyD", { metaKey: true })), chord("Win+D"));
  });

  it("修飾キーだけ・対応していないキー・codeがないときは null", () => {
    for (const code of [
      "ControlLeft",
      "ShiftRight",
      "AltLeft",
      "MetaLeft",
      "ContextMenu",
      "MediaPlayPause",
      "F13",
      "Unidentified",
      "",
      undefined,
      null,
      5,
    ]) {
      assert.equal(chordFromEvent(event(code)), null, String(code));
    }
  });

  it("日本語入力(IME)の変換中は null", () => {
    assert.equal(isImeEvent({ isComposing: true }), true);
    assert.equal(isImeEvent({ key: "Process" }), true);
    assert.equal(isImeEvent({ keyCode: 229 }), true);
    assert.equal(isImeEvent({ key: "a", isComposing: false, keyCode: 65 }), false);
    assert.equal(chordFromEvent(event("KeyA", { isComposing: true })), null);
    assert.equal(chordFromEvent(event("KeyA", { key: "Process" })), null);
    assert.equal(chordFromEvent(event("KeyA", { keyCode: 229 })), null);
  });
});

describe("ブラウザ・OS が先に処理するキー", () => {
  it("Windows: タブ・ウィンドウ・アプリの切り替えなど", () => {
    for (const text of [
      "Ctrl+W",
      "Ctrl+T",
      "Ctrl+N",
      "Ctrl+Shift+N",
      "Ctrl+Shift+T",
      "Ctrl+Tab",
      "Ctrl+Shift+Tab",
      "Ctrl+PageUp",
      "Ctrl+1",
      "Ctrl+9",
      "Alt+F4",
      "Alt+Tab",
      "Ctrl+F4",
      "Ctrl+Alt+Delete",
      "Ctrl+Shift+Esc",
    ]) {
      assert.ok(reservedReason(chord(text), "windows"), text);
    }
  });

  it("Windows: Win キーを使うものは、すべて", () => {
    for (const text of ["Win+D", "Win+Shift+S", "Win+Ctrl+Left", "Win+1"]) {
      assert.match(reservedReason(chord(text), "windows"), /Windows キー/, text);
    }
  });

  it("Windows: ふつうのショートカットは対象外", () => {
    for (const text of [
      "Ctrl+C",
      "Ctrl+V",
      "Ctrl+S",
      "Ctrl+Z",
      "F5",
      "Ctrl+Shift+P",
      "Alt+Left",
      "Ctrl+K",
      "Ctrl+0",
      "Alt+1",
    ]) {
      assert.equal(reservedReason(chord(text), "windows"), null, text);
    }
  });

  it("Mac: Command でのタブ・アプリの操作。Command のすべてではない", () => {
    for (const text of [
      "Command+W",
      "Command+T",
      "Command+N",
      "Command+Q",
      "Command+Tab",
      "Command+Space",
      "Command+H",
      "Command+M",
      "Command+1",
      "Control+Tab",
    ]) {
      assert.ok(reservedReason(chord(text), "mac"), text);
    }
    for (const text of ["Command+C", "Command+V", "Command+S", "Command+Shift+P", "Command+K"]) {
      assert.equal(reservedReason(chord(text), "mac"), null, text);
    }
  });

  it("OS が違えば、別の一覧で判断する", () => {
    assert.equal(reservedReason(chord("Ctrl+W"), "mac"), null);
    assert.equal(
      reservedReason(chord("Command+Q"), "windows"),
      "Windows キーを使うキー操作は、OS が先に処理します。",
    );
  });
});
