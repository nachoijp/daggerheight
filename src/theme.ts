import OBR from "@owlbear-rodeo/sdk";
import type { Theme } from "@owlbear-rodeo/sdk";

function applyTheme(theme: Theme) {
  const root = document.documentElement.style;
  root.setProperty("--obr-text-primary", theme.text.primary);
  root.setProperty("--obr-text-secondary", theme.text.secondary);
  root.setProperty("--obr-primary-main", theme.primary.main);
  root.setProperty("--obr-primary-contrast", theme.primary.contrastText);
  root.setProperty("--obr-background-paper", theme.background.paper);

  const isDark = theme.mode === "DARK";
  root.setProperty("--obr-overlay", isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)");
  root.setProperty("--obr-overlay-hover", isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)");
  root.setProperty("--obr-overlay-selected", isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.16)");
  root.setProperty("--obr-border-selected", isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.65)");
}

/** Keep the page's CSS variables in sync with Owlbear Rodeo's light/dark theme */
export function watchTheme(): void {
  OBR.theme.getTheme().then(applyTheme);
  OBR.theme.onChange(applyTheme);
}
