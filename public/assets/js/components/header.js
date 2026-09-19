import { mainNav, siteName } from "../config/nav.js";
import { el } from "./dom.js";
import { initNav } from "./nav.js";

// index.html と /index.html を同じ「ホーム」として扱う
function normalize(path) {
  return path.replace(/index\.html$/, "");
}

function isCurrent(href, currentPath) {
  const path = normalize(currentPath);
  return href === "/" ? path === "/" : path.startsWith(href);
}

function renderNavItem({ label, href, available = true }, currentPath) {
  if (!available) {
    // 未作成のページはリンクにせず、文字で「準備中」と示す
    return el(
      "li",
      {},
      el(
        "span",
        { class: "site-nav__link is-soon" },
        label,
        el("span", { class: "badge badge--soon" }, "準備中"),
      ),
    );
  }
  const current = isCurrent(href, currentPath);
  return el(
    "li",
    {},
    el("a", { class: "site-nav__link", href, "aria-current": current ? "page" : false }, label),
  );
}

export function renderHeader(target, currentPath = window.location.pathname) {
  const toggle = el(
    "button",
    {
      class: "nav-toggle",
      type: "button",
      "aria-expanded": "false",
      "aria-controls": "site-nav",
    },
    el("span", { class: "nav-toggle__bars", "aria-hidden": "true" }),
    "メニュー",
  );
  const nav = el(
    "nav",
    { class: "site-nav", id: "site-nav", "aria-label": "メインメニュー" },
    el(
      "ul",
      { class: "site-nav__list" },
      ...mainNav.map((item) => renderNavItem(item, currentPath)),
    ),
  );

  target.replaceChildren(
    el(
      "div",
      { class: "site-header__inner container" },
      el("a", { class: "site-logo", href: "/" }, siteName),
      toggle,
      nav,
    ),
  );
  initNav(toggle, nav);
}
