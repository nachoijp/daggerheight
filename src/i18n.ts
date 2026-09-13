export type Language = "es" | "en";

export const LANGUAGES: { id: Language; labelKey: "languageSpanish" | "languageEnglish" }[] = [
  { id: "es", labelKey: "languageSpanish" },
  { id: "en", labelKey: "languageEnglish" },
];

const STRINGS = {
  es: {
    menuLabel: "Altura",
    rankMuyCerca: "Muy cerca",
    rankCerca: "Cerca",
    rankLejos: "Lejos",
    rankMuyLejos: "Muy lejos",
    directionUp: "Arriba",
    directionDown: "Abajo",
    clear: "Quitar marcador",
    settings: "Opciones",
    settingsTitle: "Opciones de Daggerheight",
    settingsLanguage: "Idioma",
    settingsIconSize: "Tamaño de íconos",
    settingsColors: "Colores por rango",
    settingsPosition: "Posición de los íconos",
    positionLeft: "Izquierda",
    positionRight: "Derecha",
    positionTop: "Arriba",
    positionBottom: "Abajo",
    settingsScaling: "Escala de los íconos",
    scalingWithToken: "Escala con el token",
    scalingFixed: "Tamaño fijo",
    save: "Guardar",
    cancel: "Cancelar",
    languageSpanish: "Español",
    languageEnglish: "English",
  },
  en: {
    menuLabel: "Altitude",
    rankMuyCerca: "Very Close",
    rankCerca: "Close",
    rankLejos: "Far",
    rankMuyLejos: "Very Far",
    directionUp: "Up",
    directionDown: "Down",
    clear: "Remove marker",
    settings: "Settings",
    settingsTitle: "Daggerheight Settings",
    settingsLanguage: "Language",
    settingsIconSize: "Icon size",
    settingsColors: "Colors per range",
    settingsPosition: "Icon position",
    positionLeft: "Left",
    positionRight: "Right",
    positionTop: "Top",
    positionBottom: "Bottom",
    settingsScaling: "Icon scaling",
    scalingWithToken: "Scales with token",
    scalingFixed: "Fixed size",
    save: "Save",
    cancel: "Cancel",
    languageSpanish: "Español",
    languageEnglish: "English",
  },
} as const;

export type StringKey = keyof (typeof STRINGS)["es"];

export function t(language: Language, key: StringKey): string {
  return STRINGS[language][key];
}
