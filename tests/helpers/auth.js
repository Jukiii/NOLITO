// アカウントのテストの共通部品: 環境の作成、リクエストの組み立て、ログインの一連の流れ。
import { onRequestGet as callback } from "../../functions/auth/google/callback.js";
import { onRequestGet as login } from "../../functions/auth/google/login.js";
import { OAUTH_COOKIE, SESSION_COOKIE } from "../../functions/_lib/config.js";
import { CLIENT_ID } from "./fake-google.js";
import { createDb } from "./d1.js";

export const ORIGIN = "https://nolito.test";

export function makeEnv(overrides = {}) {
  return {
    DB: createDb(),
    GOOGLE_CLIENT_ID: CLIENT_ID,
    GOOGLE_CLIENT_SECRET: "test-secret",
    SESSION_SECRET: "s".repeat(48),
    SITE_ORIGIN: ORIGIN,
    AUTH_ENABLED: "true",
    SIGNUP_MODE: "invite",
    ALLOWED_EMAILS: "alice@example.com, bob@example.com",
    ...overrides,
  };
}

/** Set-Cookie の一覧から、名前の Cookie を探す。{ value, attributes(小文字の一覧) } */
export function findSetCookie(response, name) {
  for (const line of response.headers.getSetCookie()) {
    const [pair, ...attributes] = line.split(";").map((part) => part.trim());
    const at = pair.indexOf("=");
    if (pair.slice(0, at) === name) {
      return {
        value: pair.slice(at + 1),
        attributes: attributes.map((a) => a.toLowerCase()),
        line,
      };
    }
  }
  return null;
}

export const cookieHeader = (cookies) =>
  Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");

export const get = (path, { cookies = {}, headers = {} } = {}) =>
  new Request(`${ORIGIN}${path}`, {
    headers: {
      ...(Object.keys(cookies).length ? { Cookie: cookieHeader(cookies) } : {}),
      ...headers,
    },
  });

/** 状態を変える要求(POST・DELETE)。既定で、正しい Origin と CSRF ヘッダーを付ける。 */
export function write(method, path, { body, cookies = {}, headers = {}, json = true } = {}) {
  const all = {
    Origin: ORIGIN,
    "X-NOLITO-CSRF": "1",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(Object.keys(cookies).length ? { Cookie: cookieHeader(cookies) } : {}),
    ...headers,
  };
  for (const [name, value] of Object.entries(all)) if (value === null) delete all[name];
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: all,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

/**
 * ログインの一連の流れ(login → Google → callback)を行う。
 * 成功すると、session の Cookie(値)を返す。途中の応答も返す。
 */
export async function signIn(env, google, { path = "/auth/google/login", cookies = {} } = {}) {
  const loginResponse = await login({ request: get(path, { cookies }), env });
  const location = loginResponse.headers.get("Location");
  const oauth = findSetCookie(loginResponse, OAUTH_COOKIE);
  const code = google.register(location);
  const state = new URL(location).searchParams.get("state");
  const callbackResponse = await callback({
    request: get(`/auth/google/callback?code=${code}&state=${state}`, {
      cookies: { ...cookies, [OAUTH_COOKIE]: oauth.value },
    }),
    env,
  });
  const session = findSetCookie(callbackResponse, SESSION_COOKIE);
  return { loginResponse, callbackResponse, location, oauth, code, state, session };
}
