import OBR from "@owlbear-rodeo/sdk";
import type { Image, Path } from "@owlbear-rodeo/sdk";
import "./style.css";
import { DIRECTIONS, RANKS, buttonId, trianglesPreviewSvg } from "./altitude";
import {
  buildAltitudeMarker,
  getAltitudeMarkers,
  getMarkerState,
} from "./markers";
import { getLanguage, getSettings, onSettingsChange } from "./settings";
import { t } from "./i18n";
import type { AltitudeSettings } from "./settings";
import { getPluginId } from "./pluginId";
import { watchTheme } from "./theme";

async function render() {
  const [language, settings] = await Promise.all([getLanguage(), getSettings()]);

  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <table class="altitude-table">
      <thead>
        <tr>
          <th></th>
          ${RANKS.map((rank) => `<th>${t(language, rank.labelKey)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${DIRECTIONS.map(
          (direction) => `
            <tr>
              <th>${t(language, direction.labelKey)}</th>
              ${RANKS.map(
                (rank) => `
                  <td>
                    <button
                      class="rank-button"
                      id="${buttonId(rank.id, direction.id)}"
                      data-rank="${rank.id}"
                      data-direction="${direction.id}"
                      title="${t(language, rank.labelKey)} · ${t(language, direction.labelKey)}"
                    >
                      ${trianglesPreviewSvg(rank.count, direction.id, settings.colors[rank.id])}
                    </button>
                  </td>
                `
              ).join("")}
            </tr>
          `
        ).join("")}
      </tbody>
    </table>
    <div class="actions">
      <button class="clear-button">${t(language, "clear")}</button>
      <button class="settings-button" title="${t(language, "settings")}">⚙</button>
    </div>
  `;

  document
    .querySelectorAll<HTMLButtonElement>(".rank-button")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const rankId = button.dataset.rank!;
        const direction = button.dataset.direction as "UP" | "DOWN";
        handleRankClick(rankId, direction, settings);
      });
    });

  document
    .querySelector<HTMLButtonElement>(".clear-button")!
    .addEventListener("click", handleClear);

  document
    .querySelector<HTMLButtonElement>(".settings-button")!
    .addEventListener("click", () => {
      OBR.modal.open({
        id: getPluginId("settings-modal"),
        url: "/settings.html",
        width: 340,
        height: 460,
      });
    });

  await refreshActiveButtons();
}

async function handleRankClick(
  rankId: string,
  direction: "UP" | "DOWN",
  settings: AltitudeSettings
) {
  const rank = RANKS.find((r) => r.id === rankId);
  const selection = await OBR.player.getSelection();
  if (!rank || !selection || selection.length === 0) {
    return;
  }

  const [tokens, existingMarkers, dpi] = await Promise.all([
    OBR.scene.items.getItems<Image>(selection),
    getAltitudeMarkers(),
    OBR.scene.grid.getDpi(),
  ]);

  const toDelete: string[] = [];
  const toAdd: Path[] = [];
  for (const token of tokens) {
    const attached = existingMarkers.filter((m) => m.attachedTo === token.id);
    toDelete.push(...attached.map((m) => m.id));

    const alreadyActive = attached.some((m) => {
      const state = getMarkerState(m);
      return state?.rank === rankId && state.direction === direction;
    });
    if (!alreadyActive) {
      toAdd.push(buildAltitudeMarker(token, rank, direction, dpi, settings));
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
        .getElementById(buttonId(state.rank, state.direction))
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
