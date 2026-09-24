import { initAdSlots } from "./components/ad-slot.js";
import { renderBottomNav } from "./components/bottom-nav.js";
import { initConsent } from "./components/consent.js";
import { renderFooter } from "./components/footer.js";
import { renderHeader } from "./components/header.js";
import { initModals } from "./components/modal.js";
import { renderProductList } from "./components/product-list.js";
import { adsConfig } from "./config/ads.js";

const header = document.querySelector("[data-site-header]");
if (header) {
  renderHeader(header);
  renderBottomNav();
}

const footer = document.querySelector("[data-site-footer]");
if (footer) renderFooter(footer);

// フッターの「アクセス解析の設定」ボタンができた後に呼ぶ。測定 ID が未設定・本番以外のホストでは、何もしない
initConsent();

initModals();
initAdSlots(document, adsConfig);
for (const container of document.querySelectorAll("[data-product-list]")) {
  renderProductList(container);
}

// ES Modules の読み込み確認用
document.documentElement.dataset.js = "ready";
