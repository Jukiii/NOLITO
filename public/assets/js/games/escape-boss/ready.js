// 連続タイピングの「準備」(開始の前。スペースキーを押すまで、始まらない)。DOM・時計に触れない純粋な判断。
// 日本語入力(IME)がオンのままだと、全角のスペースが入る。始める前に、気づけるようにする(Issue #140)。

export const HALF_WIDTH_SPACE = " ";
// 全角スペース(U+3000)。ソースに直接書かず、文字コードから作る
export const FULL_WIDTH_SPACE = String.fromCodePoint(0x3000);

/**
 * 準備の間に、入力された1文字を、どう扱うか。
 * - "start": 半角スペース。ゲームを始める
 * - "fullwidth": 全角スペース。始めずに、全角になっていると知らせる
 * - "ignore": それ以外。何もしない(ミスにも数えない)
 */
export function readyAction(char) {
  if (char === HALF_WIDTH_SPACE) return "start";
  if (char === FULL_WIDTH_SPACE) return "fullwidth";
  return "ignore";
}

// 準備の画面で、あなたのキャラクターがつぶやく一言(Issue #173。AI の下書き。運営者の確認待ち)。
// 1 つ 20 字まで(lines.js の isValidLine と同じ決め)。軽い冗談だけにする
export const READY_LINES = Object.freeze([
  "今日こそ、逃げ切ってみせる!",
  "指ならしは、ばっちり。",
  "深呼吸して、いってみよう。",
  "ミスしても、あわてない。",
  "やる気は、じゅうぶん。",
  "まずは、落ち着いて。",
  "定時までは、あと少し!",
  "キーボード、準備オーケー!",
  "あせらず、いこう。",
  "スペースキーで、勝負だ!",
]);

/** つぶやきを 1 つ選ぶ。直前と同じものは続けない。乱数・直前の言葉は引数 */
export function pickReadyLine(random = Math.random, previous = "") {
  const choices = READY_LINES.filter((line) => line !== previous);
  const index = Math.min(Math.floor(random() * choices.length), choices.length - 1);
  return choices[index];
}
