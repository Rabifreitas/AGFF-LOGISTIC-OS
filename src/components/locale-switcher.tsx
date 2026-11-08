import { getLocale } from "next-intl/server";
import { setLocaleAction } from "@/modules/iam/actions";

export async function LocaleSwitcher({ light = false }: { light?: boolean }) {
  const locale = await getLocale();
  const next = locale === "en" ? "pt-PT" : "en";
  return (
    <form action={setLocaleAction}>
      <input type="hidden" name="locale" value={next} />
      <button type="submit" className={light ? "text-sm text-gray-300 hover:text-white" : "text-sm text-gray-600 hover:text-navy-900"}>
        {next === "en" ? "EN" : "PT"}
      </button>
    </form>
  );
}
