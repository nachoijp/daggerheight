import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { RANKS } from "./altitude";
import type { Position } from "./altitude";
import {
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

// The size slider is anchored so its midpoint is 1x (the default and most
// commonly used value): the lower half covers 0.5x-1x and the upper half
// covers 1x-2x, instead of a plain linear scale that would squeeze the
// commonly used lower range into a third of the slider.
function sliderToSize(sliderValue: number): number {
  if (sliderValue <= 50) {
    return 0.5 + (sliderValue / 50) * 0.5;
  }
  return 1 + ((sliderValue - 50) / 50) * 1;
}

function sizeToSlider(size: number): number {
  if (size <= 1) {
    return ((size - 0.5) / 0.5) * 50;
  }
  return 50 + ((size - 1) / 1) * 50;
}

const POSITION_OPTIONS: { id: Position; labelKey: "positionLeft" | "positionRight" | "positionTop" | "positionBottom" }[] = [
  { id: "LEFT", labelKey: "positionLeft" },
  { id: "RIGHT", labelKey: "positionRight" },
  { id: "TOP", labelKey: "positionTop" },
  { id: "BOTTOM", labelKey: "positionBottom" },
];

const SCALING_OPTIONS: { id: "true" | "false"; labelKey: "scalingWithToken" | "scalingFixed" }[] = [
  { id: "true", labelKey: "scalingWithToken" },
  { id: "false", labelKey: "scalingFixed" },
];

interface FormState {
  language: Language;
  position: Position;
  colors: AltitudeSettings["colors"];
  iconSize: number;
  scaleWithToken: boolean;
}

/** Re-draws the whole form from the current (possibly unsaved) form state */
function draw(state: FormState) {
  const { language } = state;

  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <h1 class="settings-title">${t(language, "settingsTitle")}</h1>

    <label class="settings-label" for="language-select">${t(language, "settingsLanguage")}</label>
    <select class="select-input" id="language-select">
      ${LANGUAGES.map(
        (lang) =>
          `<option value="${lang.id}" ${lang.id === state.language ? "selected" : ""}>${t(language, lang.labelKey)}</option>`
      ).join("")}
    </select>

    <label class="settings-label">${t(language, "settingsIconSize")}</label>
    <div class="settings-row">
      <input type="range" id="icon-size" min="0" max="100" step="1" value="${sizeToSlider(state.iconSize)}" />
      <span id="icon-size-value">${state.iconSize.toFixed(1)}x</span>
    </div>

    <label class="settings-label">${t(language, "settingsColors")}</label>
    <div class="settings-row colors-row">
      ${RANKS.map(
        (rank) => `
          <label class="color-swatch">
            <input type="color" data-rank="${rank.id}" value="${state.colors[rank.id]}" />
            <span>${t(language, rank.labelKey)}</span>
          </label>
        `
      ).join("")}
    </div>

    <label class="settings-label">${t(language, "settingsPosition")}</label>
    <div class="settings-row" id="position-row">
      ${POSITION_OPTIONS.map(
        (pos) => `<button class="choice-button" data-value="${pos.id}">${t(language, pos.labelKey)}</button>`
      ).join("")}
    </div>

    <label class="settings-label">${t(language, "settingsScaling")}</label>
    <div class="settings-row" id="scaling-row">
      ${SCALING_OPTIONS.map(
        (opt) => `<button class="choice-button" data-value="${opt.id}">${t(language, opt.labelKey)}</button>`
      ).join("")}
    </div>

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

  const scalingRow = document.getElementById("scaling-row")!;
  markSelected(scalingRow, String(state.scaleWithToken));

  const languageSelect = document.getElementById("language-select") as HTMLSelectElement;
  languageSelect.addEventListener("change", () => {
    state.language = languageSelect.value as Language;
    draw(state);
  });

  positionRow.querySelectorAll<HTMLButtonElement>(".choice-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.position = btn.dataset.value as Position;
      markSelected(positionRow, state.position);
    });
  });

  scalingRow.querySelectorAll<HTMLButtonElement>(".choice-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.scaleWithToken = btn.dataset.value === "true";
      markSelected(scalingRow, String(state.scaleWithToken));
    });
  });

  const iconSizeInput = document.getElementById("icon-size") as HTMLInputElement;
  const iconSizeValue = document.getElementById("icon-size-value")!;
  iconSizeInput.addEventListener("input", () => {
    state.iconSize = sliderToSize(parseFloat(iconSizeInput.value));
    iconSizeValue.textContent = `${state.iconSize.toFixed(1)}x`;
  });

  document
    .querySelectorAll<HTMLInputElement>('input[type="color"]')
    .forEach((input) => {
      input.addEventListener("input", () => {
        const rankId = input.dataset.rank as keyof typeof state.colors;
        state.colors[rankId] = input.value;
      });
    });

  document.getElementById("cancel-button")!.addEventListener("click", () => {
    OBR.modal.close(MODAL_ID);
  });

  document.getElementById("save-button")!.addEventListener("click", async () => {
    const newSettings: AltitudeSettings = {
      iconSize: state.iconSize,
      colors: state.colors,
      position: state.position,
      scaleWithToken: state.scaleWithToken,
    };
    await Promise.all([setSettings(newSettings), setLanguage(state.language)]);
    await refreshAllMarkers(newSettings);
    OBR.modal.close(MODAL_ID);
  });
}

async function render() {
  const [language, settings] = await Promise.all([getLanguage(), getSettings()]);
  draw({
    language,
    position: settings.position,
    colors: { ...settings.colors },
    iconSize: settings.iconSize,
    scaleWithToken: settings.scaleWithToken,
  });
}

OBR.onReady(() => {
  watchTheme();
  render();
});
