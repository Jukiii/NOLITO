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

// 準備中(available: false)の項目。リンクにせず、文字で示す
function soonItem(label) {
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

// 子(サブメニュー)を持つ項目。PC はボタンで開閉するドロップダウン、モバイルのパネルでは、
// 常に開いた状態で、親子をそのまま並べる(決定は docs/decisions/0045-phase-20-plan.md)
function submenuItem({ label, children }, currentPath, index) {
  const current = children.some((child) => isCurrent(child.href, currentPath));
  const submenuId = `site-nav-submenu-${index}`;
  const toggle = el(
    "button",
    {
      class: "site-nav__link site-nav__toggle",
      type: "button",
      "aria-expanded": "false",
      "aria-haspopup": "true",
      "aria-controls": submenuId,
      "aria-current": current ? "page" : false,
    },
    label,
    el("span", { class: "site-nav__caret", "aria-hidden": "true" }),
  );
  const submenu = el(
    "ul",
    { class: "site-nav__submenu", id: submenuId },
    ...children.map((child) => {
      const childCurrent = isCurrent(child.href, currentPath);
      return el(
        "li",
        {},
        el(
          "a",
          {
            class: "site-nav__sublink",
            href: child.href,
            "aria-current": childCurrent ? "page" : false,
          },
          child.label,
        ),
      );
    }),
  );
  return el("li", { class: "site-nav__item" }, toggle, submenu);
}

function renderNavItem(item, currentPath, index) {
  if (item.available === false) return soonItem(item.label);
  if (item.children) return submenuItem(item, currentPath, index);
  const current = isCurrent(item.href, currentPath);
  return el(
    "li",
    {},
    el(
      "a",
      { class: "site-nav__link", href: item.href, "aria-current": current ? "page" : false },
      item.label,
    ),
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
      ...mainNav.map((item, index) => renderNavItem(item, currentPath, index)),
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
