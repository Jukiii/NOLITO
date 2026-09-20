// キーみち: キー操作(ショートカット)の解析・表記・判定。DOM に依存しない(event は、必要な項目だけを読む)。
//
// キー操作(chord)は { ctrl, alt, shift, meta, key } で持つ。key は、次のどれか。
//   英字 a-z(小文字)・数字 0-9・F1-F12・Enter などの名前つきのキー・記号 ` - = [ ] \ ; ' , . /
// 記号は US 配列のラベルで持つ。JIS 配列では、キーの位置は同じでも、印字が違うものがある(例: = の位置は ^)。
// 押したキーは、印字ではなく位置(event.code)で読む。これで、Shift や配列の違いに左右されない。

export const OS_LIST = ["windows", "mac"];
export const MAX_CHORDS = 4;

const MODIFIER_KEYS = ["ctrl", "alt", "shift", "meta"];
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const DIGITS = "0123456789".split("");
const FUNCTION_KEYS = Array.from({ length: 12 }, (_, i) => `F${i + 1}`);
const NAMED_KEYS = [
  "Enter",
  "Tab",
  "Space",
  "Escape",
  "Backspace",
  "Delete",
  "Insert",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
];
const SYMBOL_KEYS = ["`", "-", "=", "[", "]", "\\", ";", "'", ",", ".", "/"];
export const KEYS = new Set([
  ...LETTERS,
  ...DIGITS,
  ...FUNCTION_KEYS,
  ...NAMED_KEYS,
  ...SYMBOL_KEYS,
]);

// ---- 文字で書いたものの解析 ----

const MODIFIER_ALIASES = {
  ctrl: "ctrl",
  control: "ctrl",
  ctl: "ctrl",
  "⌃": "ctrl",
  alt: "alt",
  option: "alt",
  opt: "alt",
  "⌥": "alt",
  shift: "shift",
  "⇧": "shift",
  win: "meta",
  windows: "meta",
  meta: "meta",
  cmd: "meta",
  command: "meta",
  super: "meta",
  "⌘": "meta",
};

const KEY_ALIASES = {
  esc: "Escape",
  escape: "Escape",
  enter: "Enter",
  return: "Enter",
  "↩": "Enter",
  tab: "Tab",
  space: "Space",
  spacebar: "Space",
  スペース: "Space",
  backspace: "Backspace",
  bs: "Backspace",
  del: "Delete",
  delete: "Delete",
  ins: "Insert",
  insert: "Insert",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pgup: "PageUp",
  pagedown: "PageDown",
  pgdn: "PageDown",
  up: "ArrowUp",
  arrowup: "ArrowUp",
  "↑": "ArrowUp",
  down: "ArrowDown",
  arrowdown: "ArrowDown",
  "↓": "ArrowDown",
  left: "ArrowLeft",
  arrowleft: "ArrowLeft",
  "←": "ArrowLeft",
  right: "ArrowRight",
  arrowright: "ArrowRight",
  "→": "ArrowRight",
  backquote: "`",
  grave: "`",
  minus: "-",
  equal: "=",
  equals: "=",
  bracketleft: "[",
  bracketright: "]",
  backslash: "\\",
  semicolon: ";",
  quote: "'",
  comma: ",",
  period: ".",
  dot: ".",
  slash: "/",
};

function keyFromToken(token) {
  const lower = token.toLowerCase();
  if (KEY_ALIASES[lower]) return KEY_ALIASES[lower];
  if (/^f([1-9]|1[0-2])$/.test(lower)) return lower.toUpperCase();
  if (token.length === 1 && KEYS.has(lower)) return lower;
  return null;
}

/**
 * 1つのキー操作の文字("Ctrl+Shift+P" など)を解析する。
 * { ok: true, chord } か { ok: false, error, token? }。
 * error は empty / bad-plus / duplicate-modifier / no-key / too-many-keys / unknown-key。
 */
export function parseChord(text) {
  const source = String(text ?? "").trim();
  if (source === "") return { ok: false, error: "empty" };
  const tokens = source.split("+").map((token) => token.trim());
  if (tokens.some((token) => token === "")) return { ok: false, error: "bad-plus" };
  const chord = { ctrl: false, alt: false, shift: false, meta: false, key: "" };
  for (const token of tokens) {
    const modifier = MODIFIER_ALIASES[token.toLowerCase()] ?? MODIFIER_ALIASES[token];
    if (modifier) {
      if (chord[modifier]) return { ok: false, error: "duplicate-modifier", token };
      chord[modifier] = true;
      continue;
    }
    const key = keyFromToken(token);
    if (!key) return { ok: false, error: "unknown-key", token };
    if (chord.key) return { ok: false, error: "too-many-keys", token };
    chord.key = key;
  }
  if (!chord.key) return { ok: false, error: "no-key" };
  return { ok: true, chord };
}

/**
 * 順に押すキー操作の列("Ctrl+K Ctrl+C")を解析する。区切りは、空白か、前後に空白のある →。
 * 「Ctrl+K, Ctrl+C」のような、末尾のカンマは許す(「Ctrl+,」のカンマは、キーとして読む)。
 * { ok: true, keys } か { ok: false, error, index?, token? }。error に too-many-chords が加わる。
 */
export function parseKeys(text) {
  const parts = String(text ?? "")
    .split(/\s+/)
    .filter((part) => part !== "" && part !== "→");
  if (parts.length === 0) return { ok: false, error: "empty" };
  if (parts.length > MAX_CHORDS) return { ok: false, error: "too-many-chords" };
  const keys = [];
  for (const [index, raw] of parts.entries()) {
    const part =
      raw.length > 1 && raw.endsWith(",") && !raw.endsWith("+,") ? raw.slice(0, -1) : raw;
    const result = parseChord(part);
    if (!result.ok) return { ...result, index };
    keys.push(result.chord);
  }
  return { ok: true, keys };
}

const PARSE_MESSAGES = {
  empty: "キーを入力してください。",
  "bad-plus": "「+」の使い方が正しくありません。キーの「+」は使えないので、= を使ってください。",
  "duplicate-modifier": "同じ修飾キーが2回あります",
  "no-key": "修飾キーだけです。押すキー(P や Enter など)も入れてください。",
  "too-many-keys": "押すキーが2つ以上あります。順に押すときは、スペースで区切ってください",
  "unknown-key": "読み取れないキーがあります",
  "too-many-chords": `順に押すキーは、${MAX_CHORDS}つまでです。`,
};

/** 解析の失敗の理由を、利用者向けの文にする。 */
export function describeParseError(result) {
  const base = PARSE_MESSAGES[result.error] ?? "キーを読み取れません。";
  return result.token ? `${base}: ${result.token}` : base;
}

// ---- 表記 ----

const MODIFIER_LABELS = {
  windows: { ctrl: "Ctrl", alt: "Alt", shift: "Shift", meta: "Win" },
  mac: { ctrl: "Control", alt: "Option", shift: "Shift", meta: "Command" },
};
const KEY_LABELS = {
  Escape: "Esc",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

export function keyLabel(key) {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  return key.length === 1 && /[a-z]/.test(key) ? key.toUpperCase() : key;
}

/** 1つのキー操作を、OS ごとの表記にする("Ctrl+Shift+P" / "Command+Shift+P")。 */
export function formatChord(chord, os = "windows") {
  const labels = MODIFIER_LABELS[os] ?? MODIFIER_LABELS.windows;
  const parts = MODIFIER_KEYS.filter((name) => chord[name]).map((name) => labels[name]);
  parts.push(keyLabel(chord.key));
  return parts.join("+");
}

/** 順に押すキー操作の列を、表記にする("Ctrl+K → Ctrl+C")。 */
export function formatKeys(keys, os = "windows") {
  return keys.map((chord) => formatChord(chord, os)).join(" → ");
}

// ---- 検査 ----

/** { ctrl, alt, shift, meta, key } の形で、key が対応しているものか。 */
export function isValidChord(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    MODIFIER_KEYS.every((name) => typeof value[name] === "boolean") &&
    typeof value.key === "string" &&
    KEYS.has(value.key)
  );
}

export function chordsEqual(a, b) {
  return MODIFIER_KEYS.every((name) => a[name] === b[name]) && a.key === b.key;
}

// ---- 押したキー(event)の読み取り ----

const KEY_FROM_CODE = {
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
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  IntlYen: "\\",
  IntlBackslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
};

function keyFromCode(code) {
  if (typeof code !== "string") return null;
  if (KEY_FROM_CODE[code]) return KEY_FROM_CODE[code];
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1].toLowerCase();
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (digit) return digit[1];
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  return null;
}

/** 日本語入力(IME)の変換中の event か。キーを、判定に使えない。 */
export function isImeEvent(event) {
  return event.isComposing === true || event.key === "Process" || event.keyCode === 229;
}

/**
 * keydown の event を、キー操作にする。修飾キーだけ・対応していないキー・IME の変換中は null。
 * 位置(event.code)で読むので、Shift を押していても、配列が違っても、同じキーになる。
 */
export function chordFromEvent(event) {
  if (isImeEvent(event)) return null;
  const key = keyFromCode(event.code);
  if (!key) return null;
  return {
    ctrl: Boolean(event.ctrlKey),
    alt: Boolean(event.altKey),
    shift: Boolean(event.shiftKey),
    meta: Boolean(event.metaKey),
    key,
  };
}

// ---- ブラウザ・OS が先に処理するキー ----
// これらは、ページに届かない、または止められないことが多い(押すと、タブが閉じる・アプリが切り替わる)。
// 「キーを押して入力」では記録できないので、文字で入力してもらう。練習モードでは、自己確認にする。

const chordText = (text) => parseChord(text).chord;
const RESERVED = {
  windows: [
    "Ctrl+W",
    "Ctrl+T",
    "Ctrl+N",
    "Ctrl+Shift+N",
    "Ctrl+Shift+T",
    "Ctrl+Shift+W",
    "Ctrl+F4",
    "Ctrl+Tab",
    "Ctrl+Shift+Tab",
    "Ctrl+PageUp",
    "Ctrl+PageDown",
    "Alt+F4",
    "Alt+Tab",
    "Ctrl+Alt+Delete",
    "Ctrl+Shift+Esc",
    ...Array.from({ length: 9 }, (_, i) => `Ctrl+${i + 1}`),
  ].map(chordText),
  mac: [
    "Command+W",
    "Command+T",
    "Command+N",
    "Command+Shift+N",
    "Command+Shift+T",
    "Command+Shift+W",
    "Command+Q",
    "Command+Tab",
    "Command+Space",
    "Command+H",
    "Command+M",
    "Control+Tab",
    "Control+Shift+Tab",
    "Command+Option+Esc",
    ...Array.from({ length: 9 }, (_, i) => `Command+${i + 1}`),
  ].map(chordText),
};

/**
 * ブラウザ・OS が先に処理するキー操作か。理由の文(なければ null)。
 * Windows では、Win キーを使うものは、すべて OS が先に処理する。
 */
export function reservedReason(chord, os = "windows") {
  if (os === "windows" && chord.meta) return "Windows キーを使うキー操作は、OS が先に処理します。";
  const list = RESERVED[os] ?? RESERVED.windows;
  if (list.some((reserved) => chordsEqual(reserved, chord))) {
    return "ブラウザ・OS が先に処理するキー操作です(タブやウィンドウ、アプリの操作)。";
  }
  return null;
}
