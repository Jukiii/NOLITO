// アカウントのメッセージ(DOM に依存しない)。サーバーが返すエラーの種類 → 利用者に見せる文。
// サーバーの functions/ に、新しいエラーの種類を足したら、ここにも足す(tests/account-page.test.js が検査する)。

/** /account/?error=<種類> で戻ってきたときの案内(ログインの失敗)。 */
export const LOGIN_ERRORS = {
  unavailable: "アカウント機能は、まだ使えません。",
  "rate-limited": "短い時間に、何度も試されました。しばらく待って、もう一度お試しください。",
  cancelled: "ログインを、キャンセルしました。",
  "not-invited":
    "このアカウントは、まだ利用できません。いまは、招待した方だけがログインできます(限定公開中)。",
  failed: "ログインできませんでした。時間をおいて、もう一度お試しください。",
};

/** API の失敗(JSON の error)の案内。 */
export const API_ERRORS = {
  "auth-unavailable": "アカウント機能は、まだ使えません。",
  "not-logged-in": "ログインの有効期限が切れました。もう一度ログインしてください。",
  "not-invited": "このアカウントは、まだ利用できません。",
  "bad-origin": "リクエストを確認できませんでした。ページを開き直して、もう一度お試しください。",
  "csrf-header-required":
    "リクエストを確認できませんでした。ページを開き直して、もう一度お試しください。",
  "rate-limited": "短い時間に、何度も操作されました。しばらく待って、もう一度お試しください。",
  "nickname-required": "ニックネームを入力してください。",
  "nickname-too-long": "ニックネームは、12文字までです。",
  "nickname-invalid": "ニックネームに、使えない文字が入っています。",
  "license-format":
    "ライセンスキーの形が違います。「NLTO-」で始まる、英数字のキーを入力してください。",
  "license-invalid":
    "このキーは、使えません。入力を確認してください(すでに使われているか、無効になっている場合もあります)。",
  "confirm-required": "確認できませんでした。もう一度お試しください。",
  "reauth-required": "安全のため、もう一度、Google でログインしてください。",
  "unsupported-media-type": "送信できませんでした。ページを開き直して、もう一度お試しください。",
  "invalid-json": "送信できませんでした。ページを開き直して、もう一度お試しください。",
  "too-large": "送信する内容が、大きすぎます。",
  "invalid-progress": "記録の形が正しくないため、保存できませんでした。",
  "invalid-settings": "設定の形が正しくないため、保存できませんでした。",
  "enabled-required": "設定を確認できませんでした。ページを開き直して、もう一度お試しください。",
  "invalid-ranking-key": "指定が正しくありません。ページを開き直して、もう一度お試しください。",
  "ranking-opt-out": "オンラインランキングに参加していないため、記録できませんでした。",
  "invalid-score": "記録の値が正しくないため、保存できませんでした。",
  "title-invalid": "称号の形式が正しくないため、保存できませんでした。",
  "server-error": "サーバーでエラーが起きました。時間をおいて、もう一度お試しください。",
  "method-not-allowed": "送信できませんでした。ページを開き直して、もう一度お試しください。",
};

export const NETWORK_ERROR =
  "通信できませんでした。ネットワークを確認して、もう一度お試しください。";
export const UNKNOWN_ERROR = "うまくいきませんでした。時間をおいて、もう一度お試しください。";

export const loginErrorMessage = (code) =>
  Object.hasOwn(LOGIN_ERRORS, code) ? LOGIN_ERRORS[code] : null;

export const apiErrorMessage = (code) =>
  Object.hasOwn(API_ERRORS, code) ? API_ERRORS[code] : UNKNOWN_ERROR;
