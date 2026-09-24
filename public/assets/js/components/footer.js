import { footerLinks, siteName, tagline } from "../config/nav.js";
import { el } from "./dom.js";

// テーマの選択肢(値は components/theme.js の THEMES と同じ)
const THEME_OPTIONS = [
  { value: "system", label: "システムの設定に合わせる" },
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
];

// 文字サイズの選択肢(値は components/font-size.js の FONT_SIZES と同じ)
const FONT_SIZE_OPTIONS = [
  { value: "standard", label: "標準" },
  { value: "large", label: "大きめ" },
  { value: "xlarge", label: "特大" },
];

// アニメーションの選択肢(値は components/motion.js の MOTIONS と同じ)
const MOTION_OPTIONS = [
  { value: "system", label: "システムの設定に合わせる" },
  { value: "reduce", label: "アニメーションを減らす" },
];

export function renderFooter(target) {
  target.replaceChildren(
    el(
      "div",
      { class: "container" },
      el("p", { class: "site-footer__name" }, siteName),
      el("p", { class: "site-footer__tagline" }, tagline),
      el(
        "div",
        { class: "site-footer__settings" },
        el("label", { class: "site-footer__settings-label", for: "theme-select" }, "テーマ"),
        el(
          "select",
          { class: "site-footer__select", id: "theme-select", "data-theme-select": true },
          ...THEME_OPTIONS.map((option) => el("option", { value: option.value }, option.label)),
        ),
        el(
          "label",
          { class: "site-footer__settings-label", for: "font-size-select" },
          "文字サイズ",
        ),
        el(
          "select",
          { class: "site-footer__select", id: "font-size-select", "data-font-size-select": true },
          ...FONT_SIZE_OPTIONS.map((option) => el("option", { value: option.value }, option.label)),
        ),
        el(
          "label",
          { class: "site-footer__settings-label", for: "motion-select" },
          "アニメーション",
        ),
        el(
          "select",
          { class: "site-footer__select", id: "motion-select", "data-motion-select": true },
          ...MOTION_OPTIONS.map((option) => el("option", { value: option.value }, option.label)),
        ),
      ),
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
