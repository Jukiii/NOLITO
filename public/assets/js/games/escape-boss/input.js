// 入力欄からの文字入力を1文字ずつ取り出す。
// スマホのソフトウェアキーボードでは keydown の key が取れないことがあるため、input イベントで値を読み、
// 読んだ後は入力欄を空に戻す(入力欄には残さない)。
export function attachInput(input, { onChar, onImeChange }) {
  let composing = false;

  // 日本語入力(IME)がオンだと、ローマ字が変換候補になり判定できない。利用者に知らせる。
  input.addEventListener("compositionstart", () => {
    composing = true;
    onImeChange(true);
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    input.value = "";
  });

  input.addEventListener("input", (event) => {
    if (composing || event.isComposing) return;
    const text = input.value;
    input.value = "";
    if (text) onImeChange(false);
    for (const char of text) onChar(char);
  });

  // Enter でフォームやボタンが動かないようにする
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });
}
