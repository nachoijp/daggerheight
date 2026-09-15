import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import {
  ICON_SHAPES,
  THEMES,
  builtInPresets,
  escapeHtml,
  getTheme,
  iconStackPreviewSvg,
  resolveLevelLabel,
  themeColorAt,
} from "./altitude";
import type { AltitudeLevel, IconShape, LevelPreset, RenderMode } from "./altitude";
import { cloneLevels, getLanguage, getSettings, setSettings } from "./settings";
import type { AltitudeSettings } from "./settings";
import { refreshAllMarkers } from "./markers";
import { t } from "./i18n";
import type { Language } from "./i18n";
import { getPluginId } from "./pluginId";
import { watchTheme } from "./theme";
import { setupCustomSelect } from "./customSelect";
import { createApplyQueue } from "./applyQueue";

const MODAL_ID = getPluginId("levels-modal");
const NEW_PRESET_VALUE = "__new__";

/** Settings as they were when the modal opened, restored if the user cancels */
let originalSettings: AltitudeSettings | null = null;

const applyQueue = createApplyQueue();

interface FormState {
  language: Language;
  iconShape: IconShape;
  levels: AltitudeLevel[];
  activePresetId: string;
  activeThemeId: string;
  customPresets: LevelPreset[];
}

/**
 * This modal only owns the fields below - everything else (icon size,
 * position, toggles, language) lives in the separate Opciones modal - so
 * every write starts from `originalSettings` (captured when this modal
 * opened) and only overrides its own fields, to avoid clobbering whatever
 * Opciones may have saved in the meantime.
 */
function settingsFromState(state: FormState): AltitudeSettings {
  return {
    ...(originalSettings as AltitudeSettings),
    iconShape: state.iconShape,
    levels: state.levels,
    activePresetId: state.activePresetId,
    activeThemeId: state.activeThemeId,
    customPresets: state.customPresets,
  };
}

function scheduleApplyLive(state: FormState) {
  applyQueue.schedule(async () => {
    const newSettings = settingsFromState(state);
    await setSettings(newSettings);
    await refreshAllMarkers(newSettings, state.language);
  });
}

function allPresets(state: FormState): LevelPreset[] {
  return [...builtInPresets(getTheme(state.activeThemeId)), ...state.customPresets];
}

function activePreset(state: FormState): LevelPreset {
  return (
    allPresets(state).find((preset) => preset.id === state.activePresetId) ??
    builtInPresets(getTheme(state.activeThemeId))[0]
  );
}

function chevronSvg(): string {
  return `<svg class="custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
}

/** Neutral preview color: readable against the panel background in both themes */
const PREVIEW_COLOR = "currentColor";

/** Re-draws the whole form from the current (possibly unsaved) form state */
function draw(state: FormState) {
  const { language } = state;
  const preset = activePreset(state);
  const theme = getTheme(state.activeThemeId);

  // Every edit (reorder, remove, add, mode toggle) rebuilds the whole form
  // from scratch, which would otherwise reset .level-list's scroll back to
  // the top each time - annoying when toggling several rows in a row with a
  // long custom list. Carry the scroll position across the rebuild instead.
  const previousScrollTop = document.querySelector<HTMLDivElement>(".level-list")?.scrollTop ?? 0;

  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <h1 class="settings-title">${t(language, "levelsTitle")}</h1>

    <label class="settings-label">${t(language, "levelsIconShape")}</label>
    <div class="custom-select" id="shape-select">
      <button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="shape-trigger-content">
          <span class="shape-preview">${iconStackPreviewSvg(state.iconShape, 2, "UP", PREVIEW_COLOR)}</span>
          <span>${t(language, ICON_SHAPES.find((shape) => shape.id === state.iconShape)!.labelKey)}</span>
        </span>
        ${chevronSvg()}
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

    <label class="settings-label">${t(language, "levelsPreset")}</label>
    <div class="custom-select" id="preset-select">
      <button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span>${escapeHtml(preset.name)}</span>
        ${chevronSvg()}
      </button>
      <ul class="custom-select-menu" role="listbox" hidden>
        ${allPresets(state)
          .map(
            (p) => `
              <li class="custom-select-option ${p.id === preset.id ? "selected" : ""}" role="option" tabindex="-1" aria-selected="${p.id === preset.id}" data-value="${p.id}">
                ${escapeHtml(p.name)}${p.builtIn ? "" : t(language, "levelsPresetCustomSuffix")}
              </li>
            `
          )
          .join("")}
        <li class="custom-select-option" role="option" tabindex="-1" data-value="${NEW_PRESET_VALUE}" style="border-top:1px solid var(--obr-overlay-hover);margin-top:4px;padding-top:8px;">
          ${t(language, "levelsNewPreset")}
        </li>
      </ul>
    </div>

    ${
      preset.builtIn
        ? ""
        : `
          <div class="preset-name-row">
            <input type="text" id="preset-name-input" value="${escapeHtml(preset.name)}" placeholder="${t(language, "levelsPresetNamePlaceholder")}" />
            <button class="icon-btn" id="delete-preset-btn" title="${t(language, "levelsDeletePreset")}">🗑</button>
          </div>
        `
    }

    <label class="settings-label">${t(language, "levelsTheme")}</label>
    <div class="custom-select" id="theme-select">
      <button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="shape-trigger-content">
          <span class="preset-swatches">${theme.colors.map((c) => `<span style="background-color:${c}"></span>`).join("")}</span>
          <span>${t(language, theme.labelKey)}</span>
        </span>
        ${chevronSvg()}
      </button>
      <ul class="custom-select-menu" role="listbox" hidden>
        ${THEMES.map(
          (th) => `
            <li class="custom-select-option preset-option" role="option" tabindex="-1" aria-selected="${th.id === theme.id}" data-value="${th.id}">
              <span class="preset-swatches">${th.colors.map((c) => `<span style="background-color:${c}"></span>`).join("")}</span>
              <span class="preset-name">${t(language, th.labelKey)}</span>
            </li>
          `
        ).join("")}
      </ul>
    </div>

    <div class="level-list">
      ${state.levels
        .map(
          (level, index) => `
            <div class="level-row" data-index="${index}">
              <div class="level-reorder">
                <button class="move-up" ${index === 0 ? "disabled" : ""} title="${t(language, "levelsMoveUp")}">▲</button>
                <button class="move-down" ${index === state.levels.length - 1 ? "disabled" : ""} title="${t(language, "levelsMoveDown")}">▼</button>
              </div>
              <input type="color" class="level-color" value="${escapeHtml(level.color)}" />
              <input type="text" class="level-label" value="${escapeHtml(resolveLevelLabel(level, language))}" />
              <div class="mode-toggle">
                <button class="mode-btn ${level.renderMode === "ICONS" ? "active" : ""}" data-mode="ICONS" title="${t(language, "levelsModeIcons")}">▲</button>
                <button class="mode-btn ${level.renderMode === "TEXT" ? "active" : ""}" data-mode="TEXT" title="${t(language, "levelsModeText")}">Abc</button>
              </div>
              <button class="level-remove" title="${t(language, "levelsRemove")}" ${state.levels.length <= 1 ? "disabled" : ""}>✕</button>
            </div>
          `
        )
        .join("")}
    </div>
    <button class="add-level-btn" id="add-level">${t(language, "levelsAdd")}</button>

    <div class="settings-actions">
      <button class="secondary-button" id="cancel-button">${t(language, "cancel")}</button>
      <button class="primary-button" id="save-button">${t(language, "save")}</button>
    </div>
  `;

  setupCustomSelect(document.getElementById("shape-select")!, (value) => {
    state.iconShape = value as IconShape;
    draw(state);
    scheduleApplyLive(state);
  });

  setupCustomSelect(document.getElementById("preset-select")!, (value) => {
    if (value === NEW_PRESET_VALUE) {
      const newPreset: LevelPreset = {
        id: crypto.randomUUID(),
        name: `${t(state.language, "levelsCustomPresetName") || "Custom"} ${state.customPresets.length + 1}`,
        builtIn: false,
        colorStartIndex: 0,
        levels: [
          {
            id: crypto.randomUUID(),
            label: `${t(state.language, "levelsNewLevelName")} 1`,
            color: themeColorAt(getTheme(state.activeThemeId), 0, 0),
            renderMode: "ICONS",
          },
        ],
      };
      state.customPresets.push(newPreset);
      state.activePresetId = newPreset.id;
      state.levels = newPreset.levels;
    } else {
      state.activePresetId = value;
      const selected = allPresets(state).find((p) => p.id === value);
      state.levels = selected ? selected.levels : state.levels;
    }
    draw(state);
    scheduleApplyLive(state);
  });

  document.getElementById("preset-name-input")?.addEventListener("input", (event) => {
    activePreset(state).name = (event.target as HTMLInputElement).value;
    const trigger = document.querySelector("#preset-select .custom-select-trigger span");
    if (trigger) {
      trigger.textContent = activePreset(state).name;
    }
    scheduleApplyLive(state);
  });

  document.getElementById("delete-preset-btn")?.addEventListener("click", () => {
    const id = activePreset(state).id;
    state.customPresets = state.customPresets.filter((p) => p.id !== id);
    state.activePresetId = "daggerheart";
    state.levels = builtInPresets(getTheme(state.activeThemeId))[0].levels;
    draw(state);
    scheduleApplyLive(state);
  });

  setupCustomSelect(document.getElementById("theme-select")!, (value) => {
    const theme = THEMES.find((th) => th.id === value);
    if (!theme) {
      return;
    }
    state.activeThemeId = theme.id;
    const preset = activePreset(state);
    state.levels.forEach((level, index) => {
      level.color = themeColorAt(theme, index, preset.colorStartIndex);
    });
    draw(state);
    scheduleApplyLive(state);
  });

  document.querySelectorAll<HTMLDivElement>(".level-row").forEach((row) => {
    const index = Number(row.dataset.index);
    const level = state.levels[index];

    row.querySelector<HTMLInputElement>(".level-color")!.addEventListener("input", (event) => {
      level.color = (event.target as HTMLInputElement).value;
      scheduleApplyLive(state);
    });

    row.querySelector<HTMLInputElement>(".level-label")!.addEventListener("input", (event) => {
      level.label = (event.target as HTMLInputElement).value;
      delete level.labelKey;
      scheduleApplyLive(state);
    });

    row.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        level.renderMode = btn.dataset.mode as RenderMode;
        draw(state);
        scheduleApplyLive(state);
      });
    });

    row.querySelector<HTMLButtonElement>(".move-up")?.addEventListener("click", () => {
      if (index === 0) return;
      [state.levels[index - 1], state.levels[index]] = [state.levels[index], state.levels[index - 1]];
      draw(state);
      scheduleApplyLive(state);
    });

    row.querySelector<HTMLButtonElement>(".move-down")?.addEventListener("click", () => {
      if (index === state.levels.length - 1) return;
      [state.levels[index + 1], state.levels[index]] = [state.levels[index], state.levels[index + 1]];
      draw(state);
      scheduleApplyLive(state);
    });

    row.querySelector<HTMLButtonElement>(".level-remove")?.addEventListener("click", () => {
      if (state.levels.length <= 1) return;
      state.levels.splice(index, 1);
      draw(state);
      scheduleApplyLive(state);
    });
  });

  document.getElementById("add-level")!.addEventListener("click", () => {
    state.levels.push({
      id: crypto.randomUUID(),
      label: `${t(state.language, "levelsNewLevelName")} ${state.levels.length + 1}`,
      color: themeColorAt(getTheme(state.activeThemeId), state.levels.length, activePreset(state).colorStartIndex),
      renderMode: "ICONS",
    });
    draw(state);
    scheduleApplyLive(state);
  });

  document.getElementById("cancel-button")!.addEventListener("click", async () => {
    applyQueue.cancelScheduled();
    await applyQueue.enqueue(async () => {
      if (originalSettings) {
        await setSettings(originalSettings);
        await refreshAllMarkers(originalSettings, state.language);
      }
    });
    OBR.modal.close(MODAL_ID);
  });

  document.getElementById("save-button")!.addEventListener("click", async () => {
    applyQueue.cancelScheduled();
    const newSettings = settingsFromState(state);
    await applyQueue.enqueue(async () => {
      await setSettings(newSettings);
      await refreshAllMarkers(newSettings, state.language);
    });
    OBR.modal.close(MODAL_ID);
  });

  const levelList = document.querySelector<HTMLDivElement>(".level-list");
  if (levelList) {
    levelList.scrollTop = previousScrollTop;
  }
}

async function render() {
  const [language, settings] = await Promise.all([getLanguage(), getSettings()]);
  originalSettings = settings;
  // state.levels/customPresets are mutated in place as the DM edits (color
  // pickers, reordering, a new custom preset's levels array) - clone them
  // here so those edits never reach into originalSettings, which Cancel
  // relies on to restore exactly what was there before this modal opened.
  draw({
    language,
    iconShape: settings.iconShape,
    levels: cloneLevels(settings.levels),
    activePresetId: settings.activePresetId,
    activeThemeId: settings.activeThemeId,
    customPresets: settings.customPresets.map((preset) => ({ ...preset, levels: cloneLevels(preset.levels) })),
  });
}

OBR.onReady(() => {
  watchTheme();
  render();
});
