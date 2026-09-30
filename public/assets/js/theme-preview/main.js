// デザイン見本ページ(/theme-preview/)。DOM に触れるのは、このファイルだけ。
// 選んだテーマは、このページの見た目にだけ反映する(サイトの設定は変えない)。
import {
  PREVIEW_THEMES,
  applyPreviewTheme,
  isPreviewTheme,
  loadStoredPreviewTheme,
  resolvePreviewTheme,
  savePreviewTheme,
} from "./themes.js";

function init() {
  const radios = [...document.querySelectorAll("[data-preview-radio]")];
  const status = document.querySelector("[data-preview-status]");
  const query = new URLSearchParams(location.search).get("theme");

  function select(id, { persist }) {
    if (!isPreviewTheme(id)) return;
    applyPreviewTheme(id);
    for (const radio of radios) radio.checked = radio.value === id;
    const theme = PREVIEW_THEMES.find((item) => item.id === id);
    if (status) status.textContent = `いま見ているデザイン: ${theme.name}`;
    if (persist) {
      savePreviewTheme(id);
      const url = new URL(location.href);
      url.searchParams.set("theme", id);
      history.replaceState(null, "", url);
    }
  }

  select(resolvePreviewTheme({ query, stored: loadStoredPreviewTheme() }), { persist: false });

  for (const radio of radios) {
    radio.addEventListener("change", () => select(radio.value, { persist: true }));
  }
  for (const button of document.querySelectorAll("[data-preview-pick]")) {
    button.addEventListener("click", () => {
      select(button.dataset.previewPick, { persist: true });
      document.querySelector("[data-preview-radio]:checked")?.focus({ preventScroll: true });
    });
  }
}

init();
