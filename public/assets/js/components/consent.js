// アクセス解析の同意バナー。画面の内容を隠さないよう、ヘッダーの直後に(重ねずに)差し込む。
// 「同意する」「同意しない」は同じ見た目・同じ重みで並べる。フッターの「アクセス解析の設定」からいつでも変更できる。
import { analyticsConfig } from "../config/analytics.js";
import { createAnalytics } from "./analytics.js";
import { initialAction, isAnalyticsAvailable, readConsent, writeConsent } from "./consent-core.js";
import { el } from "./dom.js";

function safeStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/**
 * 同意の仕組みを、ページに組み込む。main.js が、ヘッダー・フッターを描画した後に1回呼ぶ。
 * 戻り値は、テストで確認しやすいように、判断の結果と操作を返す。
 */
export function initConsent({
  config = analyticsConfig,
  hostname = globalThis.location?.hostname ?? "",
  storage = safeStorage(),
} = {}) {
  const available = isAnalyticsAvailable(config, hostname);
  const analytics = createAnalytics({ measurementId: config.measurementId });
  const settingsButton = document.querySelector("[data-consent-settings]");
  let banner = null;

  const live = el("p", { class: "visually-hidden", role: "status", "aria-live": "polite" });
  document.body.append(live);

  function hide() {
    banner?.remove();
    banner = null;
  }

  function choose(choice) {
    // 保存できなくても(プライベートブラウズなど)、このページの間は選択に従う
    writeConsent(storage, choice, config.policyVersion);
    if (choice === "granted") analytics.enable();
    else analytics.disable();
    live.textContent =
      choice === "granted" ? "アクセス解析を許可しました。" : "アクセス解析を許可しませんでした。";
    hide();
    settingsButton?.focus();
  }

  function show({ moveFocus }) {
    if (banner) return;
    const title = el(
      "h2",
      { class: "consent__title", id: "consent-title", tabindex: "-1" },
      "アクセス解析について",
    );
    banner = el(
      "section",
      { class: "consent", "aria-labelledby": "consent-title" },
      el(
        "div",
        { class: "consent__inner container" },
        title,
        el(
          "p",
          { class: "consent__text" },
          "サイトの改善のために、Google アナリティクスでアクセスを解析します。同意した場合のみ、Cookie を使って閲覧の情報を Google に送信します。詳しくは",
          el("a", { href: "/privacy/" }, "プライバシーポリシー"),
          "をご覧ください。この設定は、フッターの「アクセス解析の設定」からいつでも変えられます。",
        ),
        el(
          "div",
          { class: "consent__actions" },
          el(
            "button",
            { class: "button button--secondary", type: "button", "data-consent-choice": "granted" },
            "同意する",
          ),
          el(
            "button",
            { class: "button button--secondary", type: "button", "data-consent-choice": "denied" },
            "同意しない",
          ),
        ),
      ),
    );
    banner.addEventListener("click", (event) => {
      const choice = event.target.closest?.("[data-consent-choice]")?.dataset.consentChoice;
      if (choice) choose(choice);
    });
    document.querySelector("[data-site-header]")?.after(banner);
    if (moveFocus) title.focus();
  }

  const action = initialAction({ available, consent: readConsent(storage, config.policyVersion) });
  if (action === "enable") analytics.enable();
  if (action === "ask") show({ moveFocus: false });

  if (available && settingsButton) {
    settingsButton.hidden = false;
    settingsButton.addEventListener("click", () => show({ moveFocus: true }));
  }
  return { available, action, analytics };
}
