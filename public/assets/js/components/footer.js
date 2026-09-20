import { footerLinks, siteName, tagline } from "../config/nav.js";
import { el } from "./dom.js";

export function renderFooter(target) {
  target.replaceChildren(
    el(
      "div",
      { class: "container" },
      el("p", { class: "site-footer__name" }, siteName),
      el("p", { class: "site-footer__tagline" }, tagline),
      el(
        "nav",
        { class: "site-footer__nav", "aria-label": "フッターメニュー" },
        el(
          "ul",
          { class: "site-footer__links" },
          ...footerLinks.map((link) =>
            el("li", {}, el("a", { class: "site-footer__link", href: link.href }, link.label)),
          ),
          // アクセス解析が有効なときだけ、consent.js が表示する
          el(
            "li",
            {},
            el(
              "button",
              {
                class: "site-footer__link site-footer__button",
                type: "button",
                "data-consent-settings": true,
                hidden: true,
              },
              "アクセス解析の設定",
            ),
          ),
        ),
      ),
      el(
        "p",
        { class: "site-footer__copyright" },
        el("small", {}, `© ${new Date().getFullYear()} ${siteName}`),
      ),
    ),
  );
}
