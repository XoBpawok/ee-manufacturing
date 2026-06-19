import i18n from "../i18n";

const numberFmt = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 });

/** Formats an ISK number with the currency suffix. */
export function formatISK(value: number): string {
  return `${numberFmt.format(Math.round(value))} ISK`;
}

/** Formats ISK without rounding to an integer (up to 2 decimal places). */
export function formatISKExact(value: number): string {
  return `${numberFmt.format(value)} ISK`;
}

/** Formats a quantity (whole units). */
export function formatQuantity(value: number): string {
  return numberFmt.format(value);
}

/** Formats a duration in seconds, e.g. "3d 12h 05m" with localized unit suffixes. */
export function formatDuration(seconds: number): string {
  const t = i18n.t.bind(i18n);
  if (!Number.isFinite(seconds) || seconds <= 0) return `0${t("format.s")}`;
  const s = Math.round(seconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}${t("format.d")}`);
  if (hours) parts.push(`${hours}${t("format.h")}`);
  if (mins) parts.push(`${mins}${t("format.m")}`);
  if (!days && !hours && secs) parts.push(`${secs}${t("format.s")}`);
  return parts.join(" ") || `0${t("format.s")}`;
}
