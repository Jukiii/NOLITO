import { siteName, tagline } from "../config/nav.js";
import { el } from "./dom.js";

export function renderFooter(target) {
  target.replaceChildren(
    el(
      "div",
      { class: "container" },
      el("p", { class: "site-footer__name" }, siteName),
      el("p", { class: "site-footer__tagline" }, tagline),
      el(
        "p",
        { class: "site-footer__copyright" },
        el("small", {}, `© ${new Date().getFullYear()} ${siteName}`),
      ),
    ),
  );
}
