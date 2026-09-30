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
