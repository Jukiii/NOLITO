// GET /auth/google/login — Google のログイン画面へ送る。
// ?reauth=1 なら、Google に、もう一度ログインさせる(アカウントの削除の前の、再確認)。
import { OAUTH_COOKIE, authStatus, safeNext } from "../../_lib/config.js";
import { pkceChallenge, randomToken } from "../../_lib/crypto.js";
import { authorizeUrl } from "../../_lib/google.js";
import { cookie, methodNotAllowed, nowSeconds, redirect } from "../../_lib/http.js";
import { EVENTS, audit } from "../../_lib/audit.js";
import { clientIp, hit } from "../../_lib/rate-limit.js";
import { STATE_TTL_SECONDS, seal } from "../../_lib/state.js";

export async function onRequestGet({ request, env }) {
  if (!authStatus(env).enabled) return redirect("/account/?error=unavailable");

  const now = nowSeconds();
  const limit = await hit(env.DB, env.SESSION_SECRET, {
    name: "login",
    subject: clientIp(request),
    limit: 20,
    windowSeconds: 600,
    now,
  });
  if (!limit.ok) {
    await audit(env.DB, { event: EVENTS.rateLimited, detail: "login", now });
    return redirect("/account/?error=rate-limited");
  }

  const url = new URL(request.url);
  const state = randomToken(24);
  const nonce = randomToken(24);
  const verifier = randomToken(32);
  const reauth = url.searchParams.get("reauth") === "1";
  const sealed = await seal(env.SESSION_SECRET, {
    state,
    nonce,
    verifier,
    reauth,
    next: safeNext(url.searchParams.get("next")),
    exp: now + STATE_TTL_SECONDS,
  });
  return redirect(
    authorizeUrl(env, { state, nonce, challenge: await pkceChallenge(verifier), reauth }),
    {
      cookies: [cookie(OAUTH_COOKIE, sealed, { maxAge: STATE_TTL_SECONDS })],
    },
  );
}

export const onRequest = () => methodNotAllowed(["GET"]);
