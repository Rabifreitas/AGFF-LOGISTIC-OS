export const locales = ["pt-PT", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pt-PT";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(v: string | undefined): v is Locale {
  return !!v && (locales as readonly string[]).includes(v);
}
