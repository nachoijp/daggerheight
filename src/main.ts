import OBR from "@owlbear-rodeo/sdk";
import type { Image } from "@owlbear-rodeo/sdk";
import "./style.css";
import { DIRECTIONS, buttonId, directionalLabel, escapeHtml, iconStackPreviewSvg, readableTextColor, resolveLevelLabel } from "./altitude";
import type { AltitudeLevel } from "./altitude";
import {
  buildAltitudeMarker,
  getAltitudeMarkers,
  getMarkerState,
} from "./markers";
import type { AltitudeMarker } from "./markers";
import { getLanguage, getSettings, onSettingsChange } from "./settings";
import { t } from "./i18n";
import type { Language } from "./i18n";
import type { AltitudeSettings } from "./settings";
import { getPluginId } from "./pluginId";
import { watchTheme } from "./theme";

// Settings can now change in quick succession (each debounced tick of a live
// preview in the settings modal), so overlapping render() calls could
// otherwise resolve out of order and leave the panel showing stale settings.
let renderGeneration = 0;

// Mirror .direction-col/.altitude-table's own sizing in style.css - kept in
// sync by hand since the min-width used to decide when horizontal scrolling
// kicks in is computed here, in JS. Icon-mode columns don't need the wider
// floor (no text to fit), so a pure-icon preset like Daggerheart still gets
// the tighter width and its 4 columns keep fitting without a scrollbar; a
// preset with any TEXT-mode level uses the wider one for every column
// (table-layout:fixed needs one width for all of them) so a 3-digit
// distance ("-120 ft") fits on one line - the horizontal scroll
// (.picker-scroll) is the safety net for presets that still don't fit.
const ICON_MIN_COLUMN_WIDTH = 44;
const TEXT_MIN_COLUMN_WIDTH = 64;
const DIRECTION_COL_WIDTH = 20;
const TABLE_BORDER_SPACING = 3;
// Each icon button gets half of one level column's flex-grow share (see
// clearFlexGrow below) - together they occupy about as much width as a
// single data column, same as when only the settings gear lived there.
const ICON_BUTTON_FLEX_GROW = 0.5;

function levelPreviewMarkup(level: AltitudeLevel, index: number, direction: "UP" | "DOWN", settings: AltitudeSettings, language: Language): string {
  if (level.renderMode === "TEXT") {
    const label = directionalLabel(resolveLevelLabel(level, language), direction);
    return `<span class="level-pill-preview" style="background-color:${escapeHtml(level.color)};color:${readableTextColor(level.color)}">${escapeHtml(label)}</span>`;
  }
  return iconStackPreviewSvg(settings.iconShape, index + 1, direction, level.color);
}

async function render() {
  const generation = ++renderGeneration;
  const [language, settings] = await Promise.all([getLanguage(), getSettings()]);
  if (generation !== renderGeneration) {
    return;
  }

  const visibleDirections = settings.showDown
    ? DIRECTIONS
    : DIRECTIONS.filter((direction) => direction.id !== "DOWN");
  const directionArrow = { UP: "↑", DOWN: "↓" } as const;

  const showDirectionColumn = settings.showRankLabels;

  // table-layout:fixed keeps every level column the same width (a long
  // label like "Very Close" wraps instead of stretching its own column
  // wider than its neighbors), but fixed layout needs an explicit width to
  // divide evenly - min-width here is that floor, computed from the level
  // count so .picker-scroll's horizontal scrollbar only kicks in once the
  // columns would otherwise be squeezed thinner than MIN_COLUMN_WIDTH.
  const totalColumns = settings.levels.length + (showDirectionColumn ? 1 : 0);
  const columnWidth = settings.levels.some((level) => level.renderMode === "TEXT")
    ? TEXT_MIN_COLUMN_WIDTH
    : ICON_MIN_COLUMN_WIDTH;
  const minTableWidth =
    settings.levels.length * columnWidth +
    (showDirectionColumn ? DIRECTION_COL_WIDTH : 0) +
    (totalColumns + 1) * TABLE_BORDER_SPACING;

  // .footer-row lives outside the table (so it's never affected by
  // .picker-scroll's horizontal scroll), so it can't share the table's own
  // column widths - the closest a flex row can get is matching its growth
  // ratio to how many level columns each button conceptually spans: "Quitar
  // marcador" stands in for every column but the last one, which the two
  // icon buttons then split evenly between them.
  const clearFlexGrow = Math.max(1, settings.levels.length - 1);

  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div class="picker-scroll">
      <table class="altitude-table" style="min-width: ${minTableWidth}px">
        <colgroup>
          ${showDirectionColumn ? '<col class="direction-col" />' : ""}
          ${settings.levels.map(() => "<col />").join("")}
        </colgroup>
        ${
          settings.showRankLabels
            ? `
              <thead>
                <tr>
                  <th></th>
                  ${settings.levels.map((level) => `<th>${escapeHtml(resolveLevelLabel(level, language))}</th>`).join("")}
                </tr>
              </thead>
            `
            : ""
        }
        <tbody>
          ${visibleDirections.map(
            (direction) => `
              <tr>
                ${
                  showDirectionColumn
                    ? `<th class="direction-header" title="${t(language, direction.labelKey)}">${directionArrow[direction.id]}</th>`
                    : ""
                }
                ${settings.levels.map(
                  (level, index) => `
                    <td>
                      <button
                        class="rank-button"
                        id="${buttonId(level.id, direction.id)}"
                        data-level="${level.id}"
                        data-direction="${direction.id}"
                        title="${escapeHtml(resolveLevelLabel(level, language))} · ${t(language, direction.labelKey)}"
                      >
                        ${levelPreviewMarkup(level, index, direction.id, settings, language)}
                      </button>
                    </td>
                  `
                ).join("")}
              </tr>
            `
          ).join("")}
        </tbody>
      </table>
    </div>
    <div class="footer-row">
      ${showDirectionColumn ? '<div class="footer-spacer"></div>' : ""}
      <button class="clear-button footer-clear" style="flex-grow: ${clearFlexGrow}" title="${t(language, "clear")}">${t(language, "clear")}</button>
      <button class="settings-button footer-icon-btn" style="flex-grow: ${ICON_BUTTON_FLEX_GROW}" id="levels-button" title="${t(language, "levelsButton")}">✏️</button>
      <button class="settings-button footer-icon-btn" style="flex-grow: ${ICON_BUTTON_FLEX_GROW}" id="settings-button" title="${t(language, "settings")}">⚙</button>
    </div>
  `;

  document
    .querySelectorAll<HTMLButtonElement>(".rank-button")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const levelId = button.dataset.level!;
        const direction = button.dataset.direction as "UP" | "DOWN";
        handleLevelClick(levelId, direction, settings, language);
      });
    });

  document
    .querySelector<HTMLButtonElement>(".footer-clear")!
    .addEventListener("click", handleClear);

  document
    .getElementById("levels-button")!
    .addEventListener("click", () => {
      OBR.modal.open({
        id: getPluginId("levels-modal"),
        url: "/levels.html",
        width: 340,
        height: 580,
      });
    });

  document
    .getElementById("settings-button")!
    .addEventListener("click", () => {
      OBR.modal.open({
        id: getPluginId("settings-modal"),
        url: "/settings.html",
        width: 340,
        height: 480,
      });
    });

  await refreshActiveButtons();
}

async function handleLevelClick(
  levelId: string,
  direction: "UP" | "DOWN",
  settings: AltitudeSettings,
  language: Language
) {
  const levelIndex = settings.levels.findIndex((l) => l.id === levelId);
  const level = levelIndex >= 0 ? settings.levels[levelIndex] : undefined;
  const selection = await OBR.player.getSelection();
  if (!level || !selection || selection.length === 0) {
    return;
  }

  const [tokens, existingMarkers, dpi] = await Promise.all([
    OBR.scene.items.getItems<Image>(selection),
    getAltitudeMarkers(),
    OBR.scene.grid.getDpi(),
  ]);

  const toDelete: string[] = [];
  const toAdd: AltitudeMarker[] = [];
  for (const token of tokens) {
    const attached = existingMarkers.filter((m) => m.attachedTo === token.id);
    toDelete.push(...attached.map((m) => m.id));

    const alreadyActive = attached.some((m) => {
      const state = getMarkerState(m);
      return state?.levelId === levelId && state.direction === direction;
    });
    if (!alreadyActive) {
      toAdd.push(buildAltitudeMarker(token, level, levelIndex, direction, dpi, settings, language));
    }
  }

  if (toDelete.length > 0) {
    await OBR.scene.items.deleteItems(toDelete);
  }
  if (toAdd.length > 0) {
    await OBR.scene.items.addItems(toAdd);
  }
}

async function handleClear() {
  const selection = await OBR.player.getSelection();
  if (!selection || selection.length === 0) {
    return;
  }
  const markers = await getAltitudeMarkers();
  const toDelete = markers
    .filter((m) => m.attachedTo && selection.includes(m.attachedTo))
    .map((m) => m.id);
  if (toDelete.length > 0) {
    await OBR.scene.items.deleteItems(toDelete);
  }
}

async function refreshActiveButtons() {
  const selection = await OBR.player.getSelection();
  document
    .querySelectorAll(".rank-button")
    .forEach((el) => el.classList.remove("active"));
  if (!selection || selection.length === 0) {
    return;
  }
  const markers = await getAltitudeMarkers();
  for (const marker of markers) {
    if (!marker.attachedTo || !selection.includes(marker.attachedTo)) {
      continue;
    }
    const state = getMarkerState(marker);
    if (state) {
      document
        .getElementById(buttonId(state.levelId, state.direction))
        ?.classList.add("active");
    }
  }
}

OBR.onReady(() => {
  watchTheme();
  render();
  OBR.scene.items.onChange(refreshActiveButtons);
  onSettingsChange(() => render());
});
