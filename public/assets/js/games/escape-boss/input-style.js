// 入力方式(ローマ字の書き方)の設定。DOM・保存に依存しない。
//
// 標準   … ヘボン式(shi・chi・tsu・sha…)で表示する。si・ti・tu・sya など、ほかの書き方も受け付ける(既定)
// 訓令式 … 訓令式(si・ti・tu・sya…)で表示する。ほかの書き方も受け付ける
// 表示どおり … 表示された書き方だけを受け付ける(ほかの書き方は、ミス)。表示は、ヘボン式
//
// どの方式でも、距離の計算の「文字数の分」は、標準の長さで数える(main.js)。書き方の設定で、距離が変わらないようにするため。
export const INPUT_STYLES = Object.freeze({
  standard: Object.freeze({
    label: "標準",
    options: Object.freeze({ style: "hepburn", strict: false }),
  }),
  kunrei: Object.freeze({
    label: "訓令式で表示",
    options: Object.freeze({ style: "kunrei", strict: false }),
  }),
  strict: Object.freeze({
    label: "表示どおりだけ",
    options: Object.freeze({ style: "hepburn", strict: true }),
  }),
});
export const DEFAULT_INPUT_STYLE = "standard";

/** 知っている方式の名前か。 */
export const isInputStyle = (value) =>
  typeof value === "string" && Object.hasOwn(INPUT_STYLES, value);

/** 方式の名前から、createMatcher に渡すオプション。知らない名前は、標準。 */
export const matcherOptionsFor = (name) =>
  (isInputStyle(name) ? INPUT_STYLES[name] : INPUT_STYLES[DEFAULT_INPUT_STYLE]).options;
