// アカウント API の呼び出し(DOM に依存しない。fetch を差し替えられる)。
// 状態を変える呼び出しには、同じサイトの Origin(ブラウザが付ける)と、独自ヘッダー X-NOLITO-CSRF を付ける。
// Cookie(ログインの状態)は、ブラウザが自動で送る。JavaScript からは、読めない・触れない(HttpOnly)。
import { NETWORK_ERROR, apiErrorMessage } from "./messages.js";

export const LOGIN_PATH = "/auth/google/login";
export const REAUTH_PATH = "/auth/google/login?reauth=1";

/** { ok: true, data } か、{ ok: false, code, message, status }。例外は投げない。 */
export async function call(path, { method = "GET", body, fetchImpl = globalThis.fetch } = {}) {
  const headers = { Accept: "application/json" };
  if (method !== "GET") headers["X-NOLITO-CSRF"] = "1";
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetchImpl(path, {
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, code: "network", message: NETWORK_ERROR, status: 0 };
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // JSON でない応答(たとえば、機能がまだない環境の HTML)。失敗として扱う
  }
  if (!response.ok || data === null || typeof data !== "object") {
    const code = typeof data?.error === "string" ? data.error : "unknown";
    return { ok: false, code, message: apiErrorMessage(code), status: response.status };
  }
  return { ok: true, data };
}

/** 今の状態: { enabled, user }。取得に失敗したら、enabled: false として扱う(壊れたページにしない)。 */
export async function fetchMe(options) {
  const result = await call("/api/me", options);
  if (!result.ok || typeof result.data.enabled !== "boolean") return { enabled: false, user: null };
  return { enabled: result.data.enabled, user: result.data.user ?? null };
}

export const saveNickname = (nickname, options) =>
  call("/api/profile", { ...options, method: "POST", body: { nickname } });

export const logout = (options) => call("/api/logout", { ...options, method: "POST" });

export const deleteAccount = (options) =>
  call("/api/account", { ...options, method: "DELETE", body: { confirm: "delete" } });
