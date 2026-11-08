import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function toJson<T>(value: T): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function formatDateTime(d: Date | string | null | undefined, locale = "pt-PT"): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Luanda" }).format(
    new Date(d),
  );
}

export function formatDate(d: Date | string | null | undefined, locale = "pt-PT"): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(d));
}
