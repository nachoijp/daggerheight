import OBR from "@owlbear-rodeo/sdk";
import type { Layer } from "@owlbear-rodeo/sdk";
import { getPluginId } from "./pluginId";
import { getLanguage, getSettings, onSettingsChange, resolveLanguage } from "./settings";
import type { AltitudeSettings } from "./settings";
import { t } from "./i18n";
import type { Language } from "./i18n";

const icon = "/icon.svg";

const ALL_LAYERS: Layer[] = [
  "MAP",
  "GRID",
  "DRAWING",
  "PROP",
  "MOUNT",
  "CHARACTER",
  "ATTACHMENT",
  "NOTE",
  "TEXT",
  "RULER",
  "FOG",
  "POINTER",
  "POST_PROCESS",
  "CONTROL",
  "POPOVER",
];
const ALLOWED_LAYERS: Layer[] = ["CHARACTER", "MOUNT", "PROP"];
const DISALLOWED_LAYERS = ALL_LAYERS.filter(
  (layer) => !ALLOWED_LAYERS.includes(layer)
);

// Row-height constants mirror the layout rules in style.css
// (.altitude-table th, .rank-button, .altitude-table tfoot td) and the
// border-spacing set on .altitude-table, so the embed is sized to fit
// exactly whichever rows are actually visible instead of leaving dead
// space (or clipping content) when labels/directions are toggled off.
const THEAD_HEIGHT = 33;
const TBODY_ROW_HEIGHT = 52;
const TFOOT_HEIGHT = 38;
const ROW_SPACING = 3;
const APP_PADDING = 16;

function computeEmbedHeight(settings: AltitudeSettings): number {
  const directionRows = settings.showDown ? 2 : 1;
  const rows = (settings.showRankLabels ? 1 : 0) + directionRows + 1;
  const contentHeight =
    (settings.showRankLabels ? THEAD_HEIGHT : 0) +
    directionRows * TBODY_ROW_HEIGHT +
    TFOOT_HEIGHT;
  return contentHeight + (rows + 1) * ROW_SPACING + APP_PADDING;
}

/**
 * Runs when the extension loads. Registers the context menu entry that
 * opens the altitude marker picker for the selected token(s).
 *
 * A single "layer == X" check would require every selected item to share
 * the exact same layer, so a mixed Character+Prop selection would never
 * match. Instead we check "layer != <every disallowed layer>", which each
 * selected item can satisfy independently regardless of which allowed
 * layer it's actually on.
 *
 * The embed's height is fixed at registration time (Owlbear doesn't let an
 * already-open context menu embed resize itself), so we re-register
 * whenever the language or the settings that affect row count change. That
 * only takes effect the next time the menu is opened, not on an
 * already-open one, but that's the best available fix for this API.
 */
let registeredKey: string | null = null;

function registerMenu(language: Language, settings: AltitudeSettings) {
  const height = computeEmbedHeight(settings);
  const key = `${language}:${height}`;
  if (key === registeredKey) {
    return;
  }
  registeredKey = key;

  OBR.contextMenu.create({
    id: getPluginId("menu"),
    icons: [
      {
        icon,
        label: t(language, "menuLabel"),
        filter: {
          every: [
            { key: "type", value: "IMAGE" },
            ...DISALLOWED_LAYERS.map((layer) => ({
              key: "layer",
              value: layer,
              operator: "!=" as const,
            })),
          ],
          permissions: ["UPDATE"],
        },
      },
    ],
    embed: {
      url: "/",
      height,
    },
  });
}

OBR.onReady(async () => {
  let currentLanguage = await getLanguage();
  let currentSettings = await getSettings();
  registerMenu(currentLanguage, currentSettings);

  // Re-register with an updated label if the player changes language
  // without reloading the room.
  OBR.player.onChange((player) => {
    currentLanguage = resolveLanguage(player.metadata);
    registerMenu(currentLanguage, currentSettings);
  });

  onSettingsChange((settings) => {
    currentSettings = settings;
    registerMenu(currentLanguage, currentSettings);
  });
});
