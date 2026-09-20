// アカウントのページ(/account/)。DOM に触れるのは、このファイルだけ。
// 表示する文字列は、必ず textContent で入れる(ニックネームやメールアドレスは、利用者が決めた値)。
import { deleteAccount, fetchMe, logout, saveNickname } from "./client.js";
import { loginErrorMessage } from "./messages.js";

const root = document.querySelector("[data-account]");
if (root) init(root);

async function init(root) {
  const $ = (selector) => root.querySelector(selector);
  const views = [...root.querySelectorAll("[data-view]")];
  const status = $("[data-account-status]");
  const title = $("#account-title");
  const dialog = $("#delete-dialog");
  const deleteMessage = $("[data-delete-message]");
  const confirmButton = $("[data-delete-confirm]");
  const reauthLink = $("[data-reauth]");
  const nickname = $("#nickname");

  const show = (name) => {
    for (const view of views) view.hidden = view.dataset.view !== name;
  };
  // 通知。色だけでなく、文頭の語でも、成功と失敗を区別する(読み上げにも伝わる)
  const say = (text, kind = "ok") => {
    status.textContent = text ? `${kind === "error" ? "エラー: " : ""}${text}` : "";
    status.classList.toggle("account__status--error", kind === "error" && Boolean(text));
  };
  const resetDeleteDialog = () => {
    deleteMessage.textContent = "";
    confirmButton.hidden = false;
    confirmButton.disabled = false;
    reauthLink.hidden = true;
  };

  function renderUser(user) {
    $("[data-user-email]").textContent = user.email;
    const created = new Date(user.createdAt * 1000);
    $("[data-user-created]").textContent = Number.isNaN(created.getTime())
      ? ""
      : created.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
    nickname.value = user.nickname;
    show("signed-in");
  }

  // ログインの失敗から戻ってきたとき(/account/?error=...)の案内。アドレスからは消す(再読み込みで、また出ないように)
  const params = new URLSearchParams(location.search);
  const loginError = loginErrorMessage(params.get("error"));
  if (params.has("error")) history.replaceState(null, "", location.pathname);

  const me = await fetchMe();
  if (!me.enabled) show("unavailable");
  else if (me.user) renderUser(me.user);
  else show("signed-out");
  if (loginError && me.enabled) say(loginError, "error");

  // 期限切れなどで、ログインの状態がなくなっていたとき
  const expired = (result) => {
    if (result.code !== "not-logged-in") return false;
    dialog.close();
    show("signed-out");
    say(result.message, "error");
    title.focus();
    return true;
  };

  $("[data-nickname-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter ?? $("[data-nickname-form] button");
    button.disabled = true;
    say("保存しています…");
    const result = await saveNickname(nickname.value);
    button.disabled = false;
    if (result.ok) {
      nickname.value = result.data.user.nickname;
      say("ニックネームを保存しました。");
    } else if (!expired(result)) {
      say(result.message, "error");
      nickname.focus();
    }
  });

  $("[data-logout]").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const result = await logout();
    button.disabled = false;
    if (!result.ok) return say(result.message, "error");
    show("signed-out");
    say("ログアウトしました。");
    title.focus();
  });

  // ダイアログを開くたびに、前回のメッセージを消す(data-modal-open が、開く)
  $("[data-delete-open]").addEventListener("click", resetDeleteDialog);

  confirmButton.addEventListener("click", async () => {
    confirmButton.disabled = true;
    deleteMessage.textContent = "削除しています…";
    const result = await deleteAccount();
    if (result.ok) {
      dialog.close();
      resetDeleteDialog();
      show("deleted");
      say(null);
      title.focus();
      return;
    }
    if (expired(result)) return;
    confirmButton.disabled = false;
    deleteMessage.textContent = `エラー: ${result.message}`;
    if (result.code === "reauth-required") {
      // 取り消せない操作なので、直近にログインした人だけに許す。もう一度ログインすれば、続けられる
      confirmButton.hidden = true;
      reauthLink.hidden = false;
    }
  });
}
