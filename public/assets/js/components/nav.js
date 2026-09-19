// ハンバーガーメニューの開閉。PC幅ではメニューが常時表示されるため、幅が広がったら閉じ状態に戻す。
export function initNav(toggle, nav) {
  const desktop = window.matchMedia("(min-width: 48rem)");

  const isOpen = () => toggle.getAttribute("aria-expanded") === "true";
  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
  };

  toggle.addEventListener("click", () => setOpen(!isOpen()));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  desktop.addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
}
