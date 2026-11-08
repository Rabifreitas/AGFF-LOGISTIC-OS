import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo, buttonClass } from "@/components/ui";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const features = [1, 2, 3, 4] as const;
  const phases = [1, 2, 3, 4, 5] as const;
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-navy-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo light />
          <nav className="flex items-center gap-4">
            <LocaleSwitcher light />
            <Link href="/login" className="text-sm text-gray-200 hover:text-white">
              {t("ctaLogin")}
            </Link>
            <Link href="/register" className={buttonClass("gold")}>
              {t("ctaRegister")}
            </Link>
          </nav>
        </div>
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-16">
          <p className="text-sm font-medium uppercase tracking-wider text-gold-500">{t("tagline")}</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-5xl">{t("title")}</h1>
          <p className="mt-6 max-w-2xl text-lg text-gray-300">{t("subtitle")}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/register" className={buttonClass("gold", "px-6 py-3 text-base")}>
              {t("ctaRegister")}
            </Link>
            <Link href="/login" className={buttonClass("secondary", "px-6 py-3 text-base")}>
              {t("ctaLogin")}
            </Link>
          </div>
        </section>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold text-navy-900">{t("featuresTitle")}</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((n) => (
            <div key={n} className="rounded-lg border border-gray-200 p-6">
              <div className="mb-4 h-1 w-10 rounded bg-gold-500" />
              <h3 className="font-semibold text-navy-900">{t(`f${n}t`)}</h3>
              <p className="mt-2 text-sm text-gray-600">{t(`f${n}d`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold text-navy-900">{t("roadmapTitle")}</h2>
          <p className="mt-2 max-w-2xl text-gray-600">{t("roadmapDesc")}</p>
          <ol className="mt-8 grid gap-4 md:grid-cols-5">
            {phases.map((n) => (
              <li key={n} className={`rounded-lg border p-4 ${n === 1 ? "border-gold-500 bg-white" : "border-gray-200 bg-white/60"}`}>
                <p className="text-xs font-semibold uppercase text-gold-600">Fase {n}</p>
                <p className="mt-1 text-sm text-navy-900">{t(`phase${n}`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-gray-200">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-gray-500">{t("footer")}</div>
      </footer>
    </div>
  );
}
