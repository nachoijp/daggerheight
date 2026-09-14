import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { COLOR_PRESETS, ICON_SHAPES, RANKS, iconStackPreviewSvg } from "./altitude";
import type { IconShape, Position } from "./altitude";
import {
  MAX_ICON_DISTANCE,
  getLanguage,
  getSettings,
  setLanguage,
  setSettings,
} from "./settings";
import { refreshAllMarkers } from "./markers";
import { LANGUAGES, t } from "./i18n";
import type { Language } from "./i18n";
import type { AltitudeSettings } from "./settings";
import { getPluginId } from "./pluginId";
import { watchTheme } from "./theme";

const MODAL_ID = getPluginId("settings-modal");

/** Settings as they were when the modal opened, restored if the user cancels */
let originalSettings: AltitudeSettings | null = null;
let originalLanguage: Language | null = null;

let applyTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Every write to settings (a debounced live preview, or the final Cancel/Save)
 * is chained onto this promise instead of fired independently, so a
 * still-in-flight preview write can never resolve *after*, and overwrite,
 * a Cancel/Save that was requested later.
 */
let applyChain: Promise<void> = Promise.resolve();

function settingsFromState(state: FormState): AltitudeSettings {
  return {
    iconShape: state.iconShape,
    iconSize: state.iconSize,
    iconDistance: state.iconDistance,
    colors: state.colors,
    position: state.position,
    scaleWithToken: state.scaleWithToken,
    showDown: state.showDown,
    showRankLabels: state.showRankLabels,
  };
}

function enqueueApply(task: () => Promise<void>): Promise<void> {
  applyChain = applyChain.then(task, task);
  return applyChain;
}

function cancelScheduledApply() {
  if (applyTimer !== undefined) {
    clearTimeout(applyTimer);
    applyTimer = undefined;
  }
}

/**
 * Live-previews the current form state on the board and main panel,
 * debounced so drag-heavy controls (sliders, color pickers) don't flood the
 * scene with updates. `affectsMarkers` skips the marker rebuild for settings
 * (like the show-down/show-rank-labels toggles) that only change the main
 * panel's own layout and have no effect on already-placed markers.
 */
function scheduleApplyLive(state: FormState, affectsMarkers: boolean) {
  cancelScheduledApply();
  applyTimer = setTimeout(() => {
    applyTimer = undefined;
    const newSettings = settingsFromState(state);
    enqueueApply(async () => {
      await setSettings(newSettings);
      if (affectsMarkers) {
        await refreshAllMarkers(newSettings);
      }
    });
  }, 200);
}

// The size slider is anchored so its midpoint is 1x (the default and most
// commonly used value): the lower half covers 0.5x-1x and the upper half
// covers 1x-2x, instead of a plain linear scale that would squeeze the
// commonly used lower range into a third of the slider.
function sliderToSize(sliderValue: number): number {
  const size =
    sliderValue <= 50
      ? 0.5 + (sliderValue / 50) * 0.5
      : 1 + ((sliderValue - 50) / 50) * 1;
  // Rounded to the same precision as the displayed "x.x" label, so the
  // applied icon size never drifts while the slider sits within a range
  // that all shows the same number.
  return Math.round(size * 10) / 10;
}

function sizeToSlider(size: number): number {
  if (size <= 1) {
    return ((size - 0.5) / 0.5) * 50;
  }
  return 50 + ((size - 1) / 1) * 50;
}

function sliderToDistance(sliderValue: number): number {
  return (sliderValue / 100) * MAX_ICON_DISTANCE;
}

function distanceToSlider(distance: number): number {
  return (distance / MAX_ICON_DISTANCE) * 100;
}

const POSITION_OPTIONS: { id: Position; labelKey: "positionLeft" | "positionRight" | "positionTop" | "positionBottom" }[] = [
  { id: "LEFT", labelKey: "positionLeft" },
  { id: "RIGHT", labelKey: "positionRight" },
  { id: "TOP", labelKey: "positionTop" },
  { id: "BOTTOM", labelKey: "positionBottom" },
];

interface FormState {
  language: Language;
  position: Position;
  colors: AltitudeSettings["colors"];
  iconShape: IconShape;
  iconSize: number;
  iconDistance: number;
  scaleWithToken: boolean;
  showDown: boolean;
  showRankLabels: boolean;
}

/** Neutral preview color: readable against the panel background in both themes */
const PREVIEW_COLOR = "currentColor";

/**
 * Wires open/close and keyboard navigation for a `.custom-select` dropdown
 * (trigger button + `.custom-select-menu` of `role="option"` items), shared
 * by the language/shape/theme pickers so all three behave identically and
 * are operable with a keyboard, not just a mouse.
 */
function setupCustomSelect(container: HTMLElement, onSelect: (value: string) => void) {
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

/** Re-draws the whole form from the current (possibly unsaved) form state */
function draw(state: FormState) {
  const { language } = state;

  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <h1 class="settings-title">${t(language, "settingsTitle")}</h1>

    <label class="settings-label">${t(language, "settingsLanguage")}</label>
    <div class="custom-select" id="language-select">
      <button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span>${t(language, LANGUAGES.find((lang) => lang.id === state.language)!.labelKey)}</span>
        <svg class="custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <ul class="custom-select-menu" role="listbox" hidden>
        ${LANGUAGES.map(
          (lang) =>
            `<li class="custom-select-option ${lang.id === state.language ? "selected" : ""}" role="option" tabindex="-1" aria-selected="${lang.id === state.language}" data-value="${lang.id}">${t(language, lang.labelKey)}</li>`
        ).join("")}
      </ul>
    </div>

    <label class="settings-label">${t(language, "settingsIconShape")}</label>
    <div class="custom-select" id="shape-select">
      <button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="shape-trigger-content">
          <span class="shape-preview">${iconStackPreviewSvg(state.iconShape, 2, "UP", PREVIEW_COLOR)}</span>
          <span>${t(language, ICON_SHAPES.find((shape) => shape.id === state.iconShape)!.labelKey)}</span>
        </span>
        <svg class="custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <ul class="custom-select-menu" role="listbox" hidden>
        ${ICON_SHAPES.map(
          (shape) => `
            <li class="custom-select-option shape-option ${shape.id === state.iconShape ? "selected" : ""}" role="option" tabindex="-1" aria-selected="${shape.id === state.iconShape}" data-value="${shape.id}">
              <span class="shape-preview">${iconStackPreviewSvg(shape.id, 2, "UP", PREVIEW_COLOR)}</span>
              <span>${t(language, shape.labelKey)}</span>
            </li>
          `
        ).join("")}
      </ul>
    </div>

    <label class="settings-label">${t(language, "settingsIconSize")}</label>
    <div class="settings-row">
      <input type="range" id="icon-size" min="0" max="100" step="1" value="${sizeToSlider(state.iconSize)}" />
      <span id="icon-size-value">${state.iconSize.toFixed(1)}x</span>
    </div>

    <label class="settings-label">${t(language, "settingsIconDistance")}</label>
    <div class="settings-row">
      <input type="range" id="icon-distance" min="0" max="100" step="1" value="${distanceToSlider(state.iconDistance)}" />
      <span id="icon-distance-value">${Math.round(distanceToSlider(state.iconDistance))}%</span>
    </div>

    <label class="settings-label">${t(language, "settingsColors")}</label>
    <div class="settings-row colors-row">
      <div class="color-swatches">
        ${RANKS.map(
          (rank) => `
            <label class="color-swatch">
              <input type="color" data-rank="${rank.id}" value="${state.colors[rank.id]}" />
              <span>${t(language, rank.labelKey)}</span>
            </label>
          `
        ).join("")}
      </div>
      <div class="custom-select theme-select" id="theme-select">
        <button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false">
          <span>${t(language, "themes")}</span>
          <svg class="custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <ul class="custom-select-menu" role="listbox" hidden>
          ${COLOR_PRESETS.map(
            (preset) => `
              <li class="custom-select-option preset-option" role="option" tabindex="-1" aria-selected="false" data-value="${preset.id}">
                <span class="preset-swatches">
                  ${RANKS.map((rank) => `<span style="background-color:${preset.colors[rank.id]}"></span>`).join("")}
                </span>
                <span class="preset-name">${preset.name}</span>
              </li>
            `
          ).join("")}
        </ul>
      </div>
    </div>

    <label class="settings-label">${t(language, "settingsPosition")}</label>
    <div class="settings-row" id="position-row">
      ${POSITION_OPTIONS.map(
        (pos) => `<button class="choice-button" data-value="${pos.id}">${t(language, pos.labelKey)}</button>`
      ).join("")}
    </div>

    <label class="toggle-row" for="scaling-toggle">
      <span>${t(language, "scalingWithToken")}</span>
      <input type="checkbox" id="scaling-toggle" class="toggle-switch-input" ${state.scaleWithToken ? "checked" : ""} />
      <span class="toggle-switch"></span>
    </label>

    <label class="toggle-row" for="show-down-toggle">
      <span>${t(language, "showDownToggle")}</span>
      <input type="checkbox" id="show-down-toggle" class="toggle-switch-input" ${state.showDown ? "checked" : ""} />
      <span class="toggle-switch"></span>
    </label>

    <label class="toggle-row" for="show-rank-labels-toggle">
      <span>${t(language, "showRankLabelsToggle")}</span>
      <input type="checkbox" id="show-rank-labels-toggle" class="toggle-switch-input" ${state.showRankLabels ? "checked" : ""} />
      <span class="toggle-switch"></span>
    </label>

    <div class="settings-actions">
      <button class="secondary-button" id="cancel-button">${t(language, "cancel")}</button>
      <button class="primary-button" id="save-button">${t(language, "save")}</button>
    </div>
  `;

  function markSelected(container: HTMLElement, value: string) {
    container.querySelectorAll<HTMLButtonElement>(".choice-button").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.value === value);
    });
  }

  const positionRow = document.getElementById("position-row")!;
  markSelected(positionRow, state.position);

  setupCustomSelect(document.getElementById("language-select")!, (value) => {
    state.language = value as Language;
    draw(state);
  });

  setupCustomSelect(document.getElementById("shape-select")!, (value) => {
    state.iconShape = value as IconShape;
    draw(state);
    scheduleApplyLive(state, true);
  });

  positionRow.querySelectorAll<HTMLButtonElement>(".choice-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.position = btn.dataset.value as Position;
      markSelected(positionRow, state.position);
      scheduleApplyLive(state, true);
    });
  });

  const scalingToggle = document.getElementById("scaling-toggle") as HTMLInputElement;
  scalingToggle.addEventListener("change", () => {
    state.scaleWithToken = scalingToggle.checked;
    scheduleApplyLive(state, true);
  });

  const showDownToggle = document.getElementById("show-down-toggle") as HTMLInputElement;
  showDownToggle.addEventListener("change", () => {
    state.showDown = showDownToggle.checked;
    scheduleApplyLive(state, false);
  });

  const showRankLabelsToggle = document.getElementById("show-rank-labels-toggle") as HTMLInputElement;
  showRankLabelsToggle.addEventListener("change", () => {
    state.showRankLabels = showRankLabelsToggle.checked;
    scheduleApplyLive(state, false);
  });

  const iconSizeInput = document.getElementById("icon-size") as HTMLInputElement;
  const iconSizeValue = document.getElementById("icon-size-value")!;
  iconSizeInput.addEventListener("input", () => {
    state.iconSize = sliderToSize(parseFloat(iconSizeInput.value));
    iconSizeValue.textContent = `${state.iconSize.toFixed(1)}x`;
    scheduleApplyLive(state, true);
  });

  const iconDistanceInput = document.getElementById("icon-distance") as HTMLInputElement;
  const iconDistanceValue = document.getElementById("icon-distance-value")!;
  iconDistanceInput.addEventListener("input", () => {
    state.iconDistance = sliderToDistance(parseFloat(iconDistanceInput.value));
    iconDistanceValue.textContent = `${Math.round(parseFloat(iconDistanceInput.value))}%`;
    scheduleApplyLive(state, true);
  });

  document
    .querySelectorAll<HTMLInputElement>('input[type="color"]')
    .forEach((input) => {
      input.addEventListener("input", () => {
        const rankId = input.dataset.rank as keyof typeof state.colors;
        state.colors[rankId] = input.value;
        scheduleApplyLive(state, true);
      });
    });

  setupCustomSelect(document.getElementById("theme-select")!, (value) => {
    const preset = COLOR_PRESETS.find((p) => p.id === value);
    if (preset) {
      state.colors = { ...preset.colors };
      draw(state);
      scheduleApplyLive(state, true);
    }
  });

  document.getElementById("cancel-button")!.addEventListener("click", async () => {
    cancelScheduledApply();
    await enqueueApply(async () => {
      if (originalSettings) {
        await setSettings(originalSettings);
        await refreshAllMarkers(originalSettings);
      }
      if (originalLanguage) {
        await setLanguage(originalLanguage);
      }
    });
    OBR.modal.close(MODAL_ID);
  });

  document.getElementById("save-button")!.addEventListener("click", async () => {
    cancelScheduledApply();
    const newSettings = settingsFromState(state);
    await enqueueApply(async () => {
      await Promise.all([setSettings(newSettings), setLanguage(state.language)]);
      await refreshAllMarkers(newSettings);
    });
    OBR.modal.close(MODAL_ID);
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

async function render() {
  const [language, settings] = await Promise.all([getLanguage(), getSettings()]);
  originalSettings = settings;
  originalLanguage = language;
  draw({
    language,
    position: settings.position,
    colors: { ...settings.colors },
    iconShape: settings.iconShape,
    iconSize: settings.iconSize,
    iconDistance: settings.iconDistance,
    scaleWithToken: settings.scaleWithToken,
    showDown: settings.showDown,
    showRankLabels: settings.showRankLabels,
  });
}

OBR.onReady(() => {
  watchTheme();
  render();
});
