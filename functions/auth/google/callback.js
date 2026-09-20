// GET /auth/google/callback — Google から戻ってきた後の処理。
// state(Cookie の中身と一致するか)→ コードの交換 → ID トークンの検証 → 招待の確認 → セッションを作る。
// 失敗の理由は、画面には出さず(/account/?error=<種類>)、詳しい理由は監査ログ(個人情報なし)に残す。
import {
  OAUTH_COOKIE,
  authStatus,
  isInvited,
  normalizeEmail,
  safeNext,
} from "../../_lib/config.js";
import { EVENTS, audit, pruneAudit } from "../../_lib/audit.js";
import { exchangeCode, verifyIdToken } from "../../_lib/google.js";
import {
  clearCookie,
  methodNotAllowed,
  nowSeconds,
  parseCookies,
  redirect,
} from "../../_lib/http.js";
import { clientIp, hit, pruneRateLimits } from "../../_lib/rate-limit.js";
import { createSession, destroySession, pruneSessions } from "../../_lib/session.js";
import { open } from "../../_lib/state.js";
import { upsertUser } from "../../_lib/users.js";
import { isEmailLike } from "../../_lib/validate.js";

const PRUNE_PROBABILITY = 0.02; // ログインの 50 回に 1 回ほど、古い記録を消す

export async function onRequestGet({ request, env }) {
  if (!authStatus(env).enabled) return redirect("/account/?error=unavailable");

  const now = nowSeconds();
  const clearOauth = clearCookie(OAUTH_COOKIE);
  const fail = async (error, detail) => {
    await audit(env.DB, { event: EVENTS.loginFailed, detail, now });
    return redirect(`/account/?error=${error}`, { cookies: [clearOauth] });
  };

  const limit = await hit(env.DB, env.SESSION_SECRET, {
    name: "callback",
    subject: clientIp(request),
    limit: 20,
    windowSeconds: 600,
    now,
  });
  if (!limit.ok) {
    await audit(env.DB, { event: EVENTS.rateLimited, detail: "callback", now });
    return redirect("/account/?error=rate-limited", { cookies: [clearOauth] });
  }

  const params = new URL(request.url).searchParams;
  const saved = await open(
    env.SESSION_SECRET,
    parseCookies(request.headers.get("Cookie"))[OAUTH_COOKIE],
    now,
  );
  if (!saved) return fail("failed", "state-cookie");

  // 利用者が、Google の画面で「キャンセル」した
  if (params.get("error")) {
    await audit(env.DB, { event: EVENTS.loginFailed, detail: "cancelled", now });
    return redirect("/account/?error=cancelled", { cookies: [clearOauth] });
  }

  const code = params.get("code");
  if (!code || params.get("state") !== saved.state) return fail("failed", "state-mismatch");

  let identity;
  try {
    identity = await verifyIdToken(env, await exchangeCode(env, code, saved.verifier), {
      nonce: saved.nonce,
      now,
    });
  } catch (cause) {
    return fail("failed", String(cause?.message ?? cause));
  }
  if (!isEmailLike(identity.email)) return fail("failed", "email-shape");
  const email = normalizeEmail(identity.email);

  // 招待制: 許可リストにないメールアドレスは、アカウントを作らない
  if (!isInvited(env, email)) {
    await audit(env.DB, { event: EVENTS.loginDenied, now });
    return redirect("/account/?error=not-invited", { cookies: [clearOauth] });
  }

  const { user } = await upsertUser(env.DB, { sub: identity.sub, email, now });
  await destroySession(env.DB, request); // 前のセッションがあれば、終わらせる
  const session = await createSession(env.DB, user.id, now);
  await audit(env.DB, {
    event: EVENTS.login,
    userId: user.id,
    detail: saved.reauth ? "reauth" : "",
    now,
  });

  if (Math.random() < PRUNE_PROBABILITY) {
    await Promise.all([
      pruneSessions(env.DB, now),
      pruneAudit(env.DB, now),
      pruneRateLimits(env.DB, now),
    ]);
  }
  return redirect(safeNext(saved.next), { cookies: [session.setCookie, clearOauth] });
}

export const onRequest = () => methodNotAllowed(["GET"]);
