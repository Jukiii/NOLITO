// ハンバーガーメニューの開閉。PC幅ではメニューが常時表示されるため、幅が広がったら閉じ状態に戻す。
// サブメニュー(ドロップダウン)は、PCだけがクリックで開閉する。モバイルのパネルでは、常に開いた
// 状態で、親子をそのまま並べる(決定は docs/decisions/0045-phase-20-plan.md)。
export function initNav(toggle, nav) {
  const desktop = window.matchMedia("(min-width: 48rem)");
  const submenuToggles = [...nav.querySelectorAll(".site-nav__toggle")];

  const isOpen = () => toggle.getAttribute("aria-expanded") === "true";
  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
  };

  const setSubmenuOpen = (button, open) => {
    button.setAttribute("aria-expanded", String(open));
    button.parentElement.classList.toggle("is-open", open);
  };
  // モバイル(ハンバーガーのパネル)では、常に開いた状態から始める
  const resetSubmenus = () => {
    for (const button of submenuToggles) setSubmenuOpen(button, !desktop.matches);
  };
  resetSubmenus();

  toggle.addEventListener("click", () => setOpen(!isOpen()));

  for (const button of submenuToggles) {
    button.addEventListener("click", () => {
      if (!desktop.matches) return; // モバイルでは、常に開いたまま(閉じさせない)
      const open = button.getAttribute("aria-expanded") !== "true";
      for (const other of submenuToggles) if (other !== button) setSubmenuOpen(other, false);
      setSubmenuOpen(button, open);
    });
  }

  document.addEventListener("click", (event) => {
    if (!desktop.matches || nav.contains(event.target)) return;
    for (const button of submenuToggles) setSubmenuOpen(button, false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (desktop.matches) {
      const open = submenuToggles.find((button) => button.getAttribute("aria-expanded") === "true");
      if (open) {
        setSubmenuOpen(open, false);
        open.focus();
        return;
      }
    }
    if (isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  desktop.addEventListener("change", () => {
    setOpen(false);
    resetSubmenus();
  });
}
