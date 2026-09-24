// アカウントのページ(/account/)。DOM に触れるのは、このファイルだけ。
// 表示する文字列は、必ず textContent で入れる(ニックネームやメールアドレスは、利用者が決めた値)。
import {
  deleteAccount,
  fetchGameSync,
  fetchLicenses,
  fetchMe,
  fetchProductNames,
  logout,
  redeemLicense,
  saveGameSync,
  saveNickname,
} from "./client.js";
// ゲームの記録(要約)の検証・取り込みは、ゲーム側のロジックをそのまま使う(重複させない)
import {
  applySyncProgress,
  createStore,
  getBackend,
  syncProgressOf,
} from "../games/escape-boss/storage.js";
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
  const gameStore = createStore(getBackend());
  const syncStatus = $("[data-game-sync-status]");
  const syncMessage = $("[data-game-sync-message]");
  const syncDialog = $("[data-game-sync-dialog]");
  const syncDialogMessage = $("[data-game-sync-dialog-message]");

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

  const formatDate = (seconds) => {
    const date = new Date(seconds * 1000);
    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  };

  // ライセンスの一覧。文字は、すべて textContent で入れる(商品名は、公開データだが、同じ扱いにする)
  const licenseList = $("[data-license-list]");
  const licenseEmpty = $("[data-license-empty]");
  let productNames = new Map();

  function renderLicenses(licenses) {
    licenseList.replaceChildren(
      ...licenses.map((license) => {
        const revoked = license.status === "revoked";
        const item = document.createElement("li");
        item.className = `account-license${revoked ? " account-license--revoked" : ""}`;
        const name = document.createElement("p");
        name.className = "account-license__name";
        name.textContent = productNames.get(license.productId) ?? license.productId;
        const meta = document.createElement("p");
        meta.className = "account-license__meta";
        meta.textContent = [
          `キー: NLTO-…-${license.hint}`,
          `登録日: ${formatDate(license.redeemedAt)}`,
          `状態: ${revoked ? "無効" : "有効"}`,
        ].join(" / ");
        item.append(name, meta);
        return item;
      }),
    );
    licenseEmpty.hidden = licenses.length > 0;
  }

  // 一覧を取り直す。失敗の知らせは、呼んだ側が出す(登録の成功と、一緒に伝えるため)
  async function loadLicenses() {
    const [result, names] = await Promise.all([fetchLicenses(), fetchProductNames()]);
    productNames = names;
    if (result.ok) renderLicenses(result.data.licenses);
    return result;
  }

  // 通知(ゲームの記録)。全体の状態(say)とは別の場所に出す(ニックネーム保存などの通知と混ざらないように)
  const saySync = (text, kind = "ok") => {
    syncMessage.textContent = text ? `${kind === "error" ? "エラー: " : ""}${text}` : "";
    syncMessage.classList.toggle("account__status--error", kind === "error" && Boolean(text));
  };

  // アカウントに保存されている記録の要約の状態を、取り直して表示する
  async function loadGameSyncStatus() {
    const result = await fetchGameSync();
    if (!result.ok) {
      syncStatus.textContent = "確認できませんでした。ページを開き直してください。";
      return result;
    }
    syncStatus.textContent = result.data.progress
      ? `最後に保存したのは ${formatDate(result.data.progress.updatedAt)} です。`
      : "まだ、アカウントに保存されていません。";
    return result;
  }

  function renderUser(user) {
    $("[data-user-email]").textContent = user.email;
    $("[data-user-created]").textContent = formatDate(user.createdAt);
    nickname.value = user.nickname;
    show("signed-in");
    loadLicenses().then((result) => {
      if (!result.ok) say(result.message, "error");
    });
    loadGameSyncStatus();
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

  $("[data-license-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("#license-key");
    const button = event.submitter ?? $("[data-license-form] button");
    button.disabled = true;
    say("登録しています…");
    const result = await redeemLicense(input.value);
    button.disabled = false;
    if (result.ok) {
      input.value = "";
      // 一覧を更新してから知らせる(「登録した」と聞こえたのに、一覧にない、を作らない)
      const loaded = await loadLicenses();
      const done = result.data.already
        ? "このキーは、すでに登録済みです。"
        : "ライセンスを登録しました。";
      if (loaded.ok) say(done);
      else say(`${done}一覧を更新できませんでした。ページを開き直してください。`, "error");
    } else if (!expired(result)) {
      say(result.message, "error");
      input.focus();
    }
  });

  $("[data-game-sync-upload]").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    saySync("保存しています…");
    const { data } = gameStore.load();
    const result = await saveGameSync(syncProgressOf(data));
    button.disabled = false;
    if (result.ok) {
      syncStatus.textContent = `最後に保存したのは ${formatDate(result.data.progress.updatedAt)} です。`;
      saySync("この端末の記録を、アカウントに保存しました。");
    } else if (!expired(result)) {
      saySync(result.message, "error");
    }
  });

  $("[data-game-sync-download]").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    syncDialogMessage.hidden = true;
    const result = await fetchGameSync();
    if (!result.ok) {
      button.disabled = false;
      if (expired(result)) return;
      syncDialogMessage.textContent = result.message;
      syncDialogMessage.hidden = false;
      return;
    }
    if (!result.data.progress) {
      button.disabled = false;
      syncDialogMessage.textContent = "まだ、アカウントに保存された記録がありません。";
      syncDialogMessage.hidden = false;
      return;
    }
    const applied = gameStore.update((current) => ({
      data: applySyncProgress(current, result.data.progress),
    }));
    button.disabled = false;
    syncDialog.close();
    saySync(
      applied.saved
        ? "アカウントの記録を、この端末に読み込みました。"
        : "読み込みましたが、この端末には保存できませんでした(保存できる場所が使えません)。",
      applied.saved ? "ok" : "error",
    );
  });

  // ダイアログを開くたびに、前回のメッセージを消す
  syncDialog.addEventListener("close", () => {
    syncDialogMessage.textContent = "";
    syncDialogMessage.hidden = true;
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
