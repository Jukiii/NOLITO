// 設定(Cloudflare の環境変数・バインディング)の読み取り。
// 必要なものがそろっていなければ、アカウントの機能は、「準備中」として、何もしない(エラーにしない)。
//
//   DB                   D1 のバインディング
//   GOOGLE_CLIENT_ID     Google の OAuth クライアント ID
//   GOOGLE_CLIENT_SECRET Google の OAuth クライアントシークレット(シークレット)
//   SESSION_SECRET       32 文字以上のランダムな文字列(シークレット。state の署名・IP のハッシュに使う)
//   SITE_ORIGIN          このサイトの URL(例: https://nolito.pages.dev)。リダイレクト先・Origin の確認に使う
//   AUTH_ENABLED         "true" のときだけ、アカウントの機能を有効にする
//   SIGNUP_MODE          "open" なら誰でもログインできる。それ以外は「招待制」(許可リストだけ)
//   ALLOWED_EMAILS       招待制で、ログインを許すメールアドレス(カンマ区切り)
//   CONTACT_ENABLED      "true" のときだけ、問い合わせフォームを有効にする(DB・SESSION_SECRET・SITE_ORIGIN が要る)

export const MIN_SECRET_LENGTH = 32;

/** SITE_ORIGIN の origin(正しくなければ null)。 */
export function siteOrigin(env) {
  try {
    return new URL(env.SITE_ORIGIN).origin;
  } catch {
    return null;
  }
}

// ローカルの開発(http://localhost)か。テスト用の設定の上書きは、ここでだけ許す
export const isLocal = (env) => siteOrigin(env)?.startsWith("http://localhost") ?? false;

/** 必要な設定がそろっているか(configured)と、有効にしているか(enabled)。 */
export function authStatus(env) {
  const configured = Boolean(
    env.DB &&
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    typeof env.SESSION_SECRET === "string" &&
    env.SESSION_SECRET.length >= MIN_SECRET_LENGTH &&
    siteOrigin(env),
  );
  return { configured, enabled: configured && env.AUTH_ENABLED === "true" };
}

/** 問い合わせフォーム: DB・SESSION_SECRET(IP のハッシュに使う)・SITE_ORIGIN がそろい、CONTACT_ENABLED=true のときだけ有効。 */
export function contactStatus(env) {
  const configured = Boolean(
    env.DB &&
    typeof env.SESSION_SECRET === "string" &&
    env.SESSION_SECRET.length >= MIN_SECRET_LENGTH &&
    siteOrigin(env),
  );
  return { configured, enabled: configured && env.CONTACT_ENABLED === "true" };
}

export const signupMode = (env) => (env.SIGNUP_MODE === "open" ? "open" : "invite");

/** 招待制で、ログインを許すメールアドレス(小文字)。 */
export function allowedEmails(env) {
  return new Set(
    String(env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const normalizeEmail = (email) => String(email).trim().toLowerCase();

/** 招待制のとき、このメールアドレスは、ログインを許されているか。招待制でなければ、常に許す。 */
export const isInvited = (env, email) =>
  signupMode(env) === "open" || allowedEmails(env).has(normalizeEmail(email));

const GOOGLE = {
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
  issuers: ["https://accounts.google.com", "accounts.google.com"],
};

/**
 * Google の各 URL と、ID トークンの発行者。
 * ローカルの開発(SITE_ORIGIN が http://localhost)のときだけ、環境変数で、テスト用の偽の Google に差し替えられる。
 * 本番で、差し替えられることはない。
 */
export function oidc(env) {
  if (!isLocal(env)) return GOOGLE;
  return {
    authUrl: env.GOOGLE_AUTH_URL || GOOGLE.authUrl,
    tokenUrl: env.GOOGLE_TOKEN_URL || GOOGLE.tokenUrl,
    jwksUrl: env.GOOGLE_JWKS_URL || GOOGLE.jwksUrl,
    issuers: env.GOOGLE_ISSUER ? [env.GOOGLE_ISSUER] : GOOGLE.issuers,
  };
}

// Cookie の名前。__Host- をつけると、ブラウザが、Secure・Path=/・Domain なしを強制する
export const SESSION_COOKIE = "__Host-nolito_session";
export const OAUTH_COOKIE = "__Host-nolito_oauth";

// ログイン後に戻ってよい場所(サイト内の、決まったパスだけ。オープンリダイレクトを防ぐ)
export const NEXT_PATHS = ["/account/"];
export const DEFAULT_NEXT = "/account/";

export function safeNext(value) {
  return NEXT_PATHS.includes(value) ? value : DEFAULT_NEXT;
}
