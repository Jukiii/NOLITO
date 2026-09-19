import { renderFooter } from "./components/footer.js";
import { renderHeader } from "./components/header.js";
import { initModals } from "./components/modal.js";

const header = document.querySelector("[data-site-header]");
if (header) renderHeader(header);

const footer = document.querySelector("[data-site-footer]");
if (footer) renderFooter(footer);

initModals();

// ES Modules の読み込み確認用
document.documentElement.dataset.js = "ready";
