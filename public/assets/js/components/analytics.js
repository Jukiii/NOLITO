// Google Analytics 4 の読み込み。enable() を呼ぶまで、Google のサーバーには何も要求しない。
// gtag のスクリプトは、同意の後に1回だけ読み込む。ページビューは、config で自動で送られる。

// Google アナリティクスの Cookie(_ga で始まるもの)を、この端末から消す(できる範囲で)
export function expireAnalyticsCookies(doc) {
  const names = doc.cookie
    .split(";")
    .map((part) => part.split("=")[0].trim())
    .filter((name) => name.startsWith("_ga"));
  // Cookie は、作られたときのドメイン属性と同じ指定でないと消せない。属性なし・ホスト名・.ホスト名 の3通りを試す
  const host = doc.location?.hostname;
  for (const name of names) {
    doc.cookie = `${name}=; Max-Age=0; path=/`;
    if (host) {
      doc.cookie = `${name}=; Max-Age=0; path=/; domain=${host}`;
      doc.cookie = `${name}=; Max-Age=0; path=/; domain=.${host}`;
    }
  }
  return names;
}

export function createAnalytics({ measurementId, doc = document, win = window }) {
  let loaded = false;
  return {
    get loaded() {
      return loaded;
    },
    enable() {
      win[`ga-disable-${measurementId}`] = false;
      if (loaded) return;
      loaded = true;
      win.dataLayer = win.dataLayer || [];
      // Google の標準の書き方。dataLayer には、引数のリストではなく arguments をそのまま入れる
      win.gtag = function gtag() {
        win.dataLayer.push(arguments);
      };
      win.gtag("js", new Date());
      win.gtag("config", measurementId);
      const script = doc.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      doc.head.append(script);
    },
    // 同意の撤回。読み込み済みのスクリプトは取り消せないため、Google が定める無効化の印を付け、Cookie を消す
    disable() {
      win[`ga-disable-${measurementId}`] = true;
      expireAnalyticsCookies(doc);
    },
  };
}
