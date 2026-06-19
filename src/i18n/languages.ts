import type { Locale } from "antd/es/locale";
import ukUA from "antd/locale/uk_UA";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import esES from "antd/locale/es_ES";
import deDE from "antd/locale/de_DE";
import frFR from "antd/locale/fr_FR";
import plPL from "antd/locale/pl_PL";
import ptPT from "antd/locale/pt_PT";

export interface LanguageMeta {
  code: string;
  // Endonym (name of the language in that language).
  nativeName: string;
  flag: string;
  antd: Locale;
}

// Ukrainian is intentionally first. Russian is deliberately excluded.
export const LANGUAGES: LanguageMeta[] = [
  { code: "uk", nativeName: "Українська", flag: "🇺🇦", antd: ukUA },
  { code: "en", nativeName: "English", flag: "🇬🇧", antd: enUS },
  { code: "zh", nativeName: "中文", flag: "🇨🇳", antd: zhCN },
  { code: "es", nativeName: "Español", flag: "🇪🇸", antd: esES },
  { code: "de", nativeName: "Deutsch", flag: "🇩🇪", antd: deDE },
  { code: "fr", nativeName: "Français", flag: "🇫🇷", antd: frFR },
  { code: "pl", nativeName: "Polski", flag: "🇵🇱", antd: plPL },
  { code: "pt", nativeName: "Português", flag: "🇵🇹", antd: ptPT },
];

export const DEFAULT_LANGUAGE = "uk";

export function antdLocaleFor(code: string): Locale {
  return (LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]).antd;
}
