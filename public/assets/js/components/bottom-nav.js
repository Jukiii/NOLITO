// モバイルの下部固定バー(重要機能)。幅 48rem未満のときだけ、CSSで表示する。
// 決定は docs/decisions/0045-phase-20-plan.md(ui-guidelines.md の「モバイルはハンバーガー＋重要機能」)。
import { bottomNav } from "../config/nav.js";
import { el } from "./dom.js";

function normalize(path) {
  return path.replace(/index\.html$/, "");
}

function isCurrent(href, currentPath) {
  const path = normalize(currentPath);
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function renderBottomNav(currentPath = window.location.pathname) {
  const nav = el(
    "nav",
    { class: "bottom-nav", "aria-label": "重要な機能(モバイル)" },
    el(
      "ul",
      { class: "bottom-nav__list" },
      ...bottomNav.map((item) => {
        const current = isCurrent(item.href, currentPath);
        return el(
          "li",
          {},
          el(
            "a",
            {
              class: "bottom-nav__link",
              href: item.href,
              "aria-current": current ? "page" : false,
            },
            item.label,
          ),
        );
      }),
    ),
  );
  document.body.append(nav);
  return nav;
}
