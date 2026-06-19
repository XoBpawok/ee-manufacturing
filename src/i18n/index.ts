import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import uk from "./locales/uk";
import en from "./locales/en";
import zh from "./locales/zh";
import es from "./locales/es";
import de from "./locales/de";
import fr from "./locales/fr";
import pl from "./locales/pl";
import pt from "./locales/pt";
import { DEFAULT_LANGUAGE, LANGUAGES } from "./languages";

export const LANG_STORAGE_KEY = "ec-manufacturing:lang:v1";

const resources = {
  uk: { translation: uk },
  en: { translation: en },
  zh: { translation: zh },
  es: { translation: es },
  de: { translation: de },
  fr: { translation: fr },
  pl: { translation: pl },
  pt: { translation: pt },
};

function initialLanguage(): string {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && LANGUAGES.some((l) => l.code === stored)) return stored;
  } catch {
    // localStorage may be unavailable (private mode); fall back to default.
  }
  return DEFAULT_LANGUAGE;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

// Persist the chosen language and keep <html lang> in sync.
i18n.on("languageChanged", (lng) => {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lng);
  } catch {
    // Ignore storage write failures.
  }
  document.documentElement.lang = lng;
});

document.documentElement.lang = i18n.language;

export default i18n;
