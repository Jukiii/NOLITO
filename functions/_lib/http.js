// HTTP の応答・Cookie・リクエストの読み取りの部品。
// 応答には、必ず no-store(個人ごとの応答を、キャッシュさせない)と nosniff を付ける。

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
};

function withHeaders(headers, cookies) {
  const result = new Headers({ ...BASE_HEADERS, ...headers });
  for (const value of cookies) result.append("Set-Cookie", value);
  return result;
}

export function json(body, { status = 200, cookies = [], headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: withHeaders(
      { "Content-Type": "application/json; charset=utf-8", ...headers },
      cookies,
    ),
  });
}

export function redirect(location, { status = 302, cookies = [] } = {}) {
  return new Response(null, { status, headers: withHeaders({ Location: location }, cookies) });
}

export const error = (status, code, extra = {}) => json({ error: code, ...extra }, { status });

export const methodNotAllowed = (allowed) =>
  json({ error: "method-not-allowed" }, { status: 405, headers: { Allow: allowed.join(", ") } });

/** Cookie ヘッダーを、{ 名前: 値 } にする。 */
export function parseCookies(header) {
  const cookies = {};
  for (const raw of String(header ?? "").split(";")) {
    const part = raw.trim();
    const at = part.indexOf("=");
    if (at < 1) continue;
    const name = part.slice(0, at).trim();
    if (!(name in cookies)) cookies[name] = part.slice(at + 1).trim();
  }
  return cookies;
}

// __Host- の Cookie の条件: Secure・Path=/・Domain なし。HttpOnly(スクリプトから読めない)・SameSite=Lax
const ATTRIBUTES = "Path=/; Secure; HttpOnly; SameSite=Lax";

export const cookie = (name, value, { maxAge }) =>
  `${name}=${value}; ${ATTRIBUTES}; Max-Age=${maxAge}`;
export const clearCookie = (name) => `${name}=; ${ATTRIBUTES}; Max-Age=0`;

const DEFAULT_MAX_BODY_BYTES = 4096;

/** JSON の本文を読む。Content-Type が JSON で、maxBytes(既定 4KB)以内で、オブジェクトのものだけ。 */
export async function readJson(request, { maxBytes = DEFAULT_MAX_BODY_BYTES } = {}) {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return { ok: false, error: "unsupported-media-type" };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return { ok: false, error: "too-large" };
  try {
    const value = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value))
      throw new Error("not object");
    return { ok: true, value };
  } catch {
    return { ok: false, error: "invalid-json" };
  }
}

export const nowSeconds = () => Math.floor(Date.now() / 1000);
