/**
 * Wires open/close and keyboard navigation for a `.custom-select` dropdown
 * (trigger button + `.custom-select-menu` of `role="option"` items), shared
 * by every dropdown across the settings and levels modals so they all behave
 * identically and are operable with a keyboard, not just a mouse.
 */
export function setupCustomSelect(container: HTMLElement, onSelect: (value: string) => void) {
  const trigger = container.querySelector<HTMLButtonElement>(".custom-select-trigger")!;
  const menu = container.querySelector<HTMLUListElement>(".custom-select-menu")!;
  const options = Array.from(menu.querySelectorAll<HTMLLIElement>('[role="option"]'));

  function setOpen(open: boolean) {
    container.classList.toggle("open", open);
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  }

  function choose(option: HTMLLIElement) {
    onSelect(option.dataset.value ?? "");
    setOpen(false);
    trigger.focus();
  }

  trigger.addEventListener("click", () => {
    const willOpen = !container.classList.contains("open");
    setOpen(willOpen);
    if (willOpen) {
      const selected = options.find((option) => option.getAttribute("aria-selected") === "true");
      (selected ?? options[0])?.focus();
    }
  });

  options.forEach((option, index) => {
    option.addEventListener("click", () => choose(option));
    option.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          options[(index + 1) % options.length].focus();
          break;
        case "ArrowUp":
          event.preventDefault();
          options[(index - 1 + options.length) % options.length].focus();
          break;
        case "Home":
          event.preventDefault();
          options[0].focus();
          break;
        case "End":
          event.preventDefault();
          options[options.length - 1].focus();
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          choose(option);
          break;
      }
    });
  });
}

function closeCustomSelect(el: HTMLElement, focusTrigger: boolean) {
  el.classList.remove("open");
  el.querySelector<HTMLElement>(".custom-select-menu")!.hidden = true;
  const trigger = el.querySelector<HTMLButtonElement>(".custom-select-trigger")!;
  trigger.setAttribute("aria-expanded", "false");
  if (focusTrigger) {
    trigger.focus();
  }
}

document.addEventListener("click", (event) => {
  document.querySelectorAll<HTMLElement>(".custom-select.open").forEach((el) => {
    if (!el.contains(event.target as Node)) {
      closeCustomSelect(el, false);
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.querySelectorAll<HTMLElement>(".custom-select.open").forEach((el) => {
      closeCustomSelect(el, el.contains(document.activeElement));
    });
  }
});
