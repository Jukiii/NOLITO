// アクセス解析の同意の判断。DOM に依存しない純粋なロジック。
// 方針: 同意するまで何も送信しない(オプトイン)。同意は端末に保存し、いつでも変更できる。

export const CONSENT_KEY = "nolito:consent:v1";
export const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;

/**
 * 計測できる状態か。測定 ID が正しい形で設定されていて、いまのホストが計測の対象であること。
 * どちらかが欠けていれば、バナーも出さず、何も読み込まない。
 */
export function isAnalyticsAvailable(config, hostname) {
  return (
    MEASUREMENT_ID_PATTERN.test(config.measurementId ?? "") &&
    Array.isArray(config.hosts) &&
    config.hosts.includes(hostname)
  );
}

// 保存されている同意。"granted" / "denied" / null(未回答・壊れている・ポリシーの版が古い)
export function readConsent(storage, policyVersion) {
  try {
    const raw = storage?.getItem(CONSENT_KEY);
    if (raw === null || raw === undefined) return null;
    const value = JSON.parse(raw);
    const valid = value?.analytics === "granted" || value?.analytics === "denied";
    return valid && value.policyVersion === policyVersion ? value.analytics : null;
  } catch {
    return null;
  }
}

export function writeConsent(storage, choice, policyVersion, now = Date.now()) {
  if (choice !== "granted" && choice !== "denied") return false;
  try {
    storage.setItem(CONSENT_KEY, JSON.stringify({ analytics: choice, policyVersion, at: now }));
    return true;
  } catch {
    return false;
  }
}

/** ページを開いたときの動作。"enable"(同意済みなので計測を始める)/ "ask"(バナーで尋ねる)/ "none"(何もしない) */
export function initialAction({ available, consent }) {
  if (!available) return "none";
  if (consent === "granted") return "enable";
  if (consent === "denied") return "none";
  return "ask";
}
