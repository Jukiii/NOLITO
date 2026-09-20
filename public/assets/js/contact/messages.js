// 問い合わせフォームのメッセージ(DOM に依存しない)。サーバーが返すエラーの種類 → 利用者に見せる文。
// サーバー(functions/)に、新しいエラーの種類を足したら、ここにも足す(tests/account-page.test.js が検査する)。

export const CONTACT_ERRORS = {
  "contact-unavailable": "お問い合わせフォームは、まだ使えません。",
  "contact-category": "種類を選んでください。",
  "contact-invalid": "入力の内容を、確認してください。ページを開き直して、もう一度お試しください。",
  "contact-message-short": "内容は、10文字以上で入力してください。",
  "contact-message-long": "内容は、2000文字までです。",
  "contact-message-invalid": "内容に、使えない文字が入っています。",
  "contact-email": "メールアドレスの形が正しくありません。返信が不要なときは、空にしてください。",
  "rate-limited": "短い時間に、何度も送信されました。しばらく待って、もう一度お試しください。",
  "bad-origin": "リクエストを確認できませんでした。ページを開き直して、もう一度お試しください。",
  "csrf-header-required":
    "リクエストを確認できませんでした。ページを開き直して、もう一度お試しください。",
  "unsupported-media-type": "送信できませんでした。ページを開き直して、もう一度お試しください。",
  "invalid-json": "送信できませんでした。ページを開き直して、もう一度お試しください。",
  "too-large": "送信する内容が、大きすぎます。短くして、もう一度お試しください。",
  "method-not-allowed": "送信できませんでした。ページを開き直して、もう一度お試しください。",
  "server-error": "サーバーでエラーが起きました。時間をおいて、もう一度お試しください。",
};

export const NETWORK_ERROR =
  "通信できませんでした。ネットワークを確認して、もう一度お試しください。";
export const UNKNOWN_ERROR = "送信できませんでした。時間をおいて、もう一度お試しください。";

export const contactErrorMessage = (code) =>
  Object.hasOwn(CONTACT_ERRORS, code) ? CONTACT_ERRORS[code] : UNKNOWN_ERROR;
