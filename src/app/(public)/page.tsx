import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, BarChart3, Boxes, CreditCard, Layers, Truck, Warehouse } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo, buttonClass } from "@/components/ui";

const MODULE_BAR = [
  { n: 0, icon: Layers, live: true },
  { n: 1, icon: Truck, live: true },
  { n: 2, icon: Boxes, live: true },
  { n: 3, icon: Warehouse, live: false },
  { n: 4, icon: BarChart3, live: false },
  { n: 5, icon: CreditCard, live: false },
] as const;

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const features = [1, 2, 3, 4] as const;
  const sectors = [0, 1, 2, 3, 4] as const;
  const phases = [1, 2, 3, 4, 5] as const;
  return (
    <div className="bg-navy-950 min-h-screen text-white">
      <header className="from-navy-950 via-navy-900 to-navy-800 relative overflow-hidden bg-gradient-to-br">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Logo light />
          <nav className="flex items-center gap-5 text-sm text-gray-300">
            <a href="#solutions" className="hidden hover:text-white lg:inline">
              {t("navSolutions")}
            </a>
            <a href="#platform" className="hidden hover:text-white lg:inline">
              {t("navPlatform")}
            </a>
            <a href="#industries" className="hidden hover:text-white lg:inline">
              {t("navIndustries")}
            </a>
            <a href="#roadmap" className="hidden hover:text-white lg:inline">
              {t("navRoadmap")}
            </a>
            <LocaleSwitcher light />
            <Link href="/login" className="hover:text-white">
              {t("ctaLogin")}
            </Link>
            <Link href="/register" className={buttonClass("gold", "rounded-full")}>
              {t("ctaRegister")}
            </Link>
          </nav>
        </div>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pt-10 pb-16 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="text-gold-500 text-sm font-bold tracking-wider">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl leading-[1.1] font-bold md:text-5xl">
              {t.rich("titleRich", { gold: (c) => <span className="text-gold-500">{c}</span> })}
            </h1>
            <p className="mt-6 max-w-xl text-lg text-gray-300">{t("subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className={buttonClass("gold", "rounded-full px-6 py-3 text-base")}>
                {t("ctaRegister")} <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <a
                href="#platform"
                className="inline-flex items-center rounded-full border border-white/60 px-6 py-3 text-base font-medium hover:bg-white/10"
              >
                {t("ctaExplore")}
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="bg-gold-500/20 absolute -inset-6 rounded-[2rem] blur-3xl" aria-hidden />
            <Image
              src="/brand/hero.png"
              alt=""
              width={924}
              height={662}
              priority
              className="relative w-full rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
            />
          </div>
        </section>
        <div id="platform" className="mx-auto max-w-6xl px-6 pb-16">
          <ul className="bg-navy-900/80 grid grid-cols-2 divide-white/10 rounded-2xl border border-white/10 shadow-xl backdrop-blur sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
            {MODULE_BAR.map(({ n, icon: Icon, live }) => (
              <li key={n} className="flex flex-col items-center px-3 py-5 text-center">
                <Icon aria-hidden className="text-gold-500 h-8 w-8" strokeWidth={1.5} />
                <p className="mt-2 font-[family-name:var(--font-display)] font-bold">{t(`m${n}t`)}</p>
                <p className="mt-0.5 text-xs text-gray-400">{t(`m${n}d`)}</p>
                {!live && (
                  <span className="text-gold-300 mt-2 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase">
                    {t("soon")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <main className="bg-gray-50 text-gray-900">
        <section id="solutions" className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-navy-900 text-2xl font-bold">{t("featuresTitle")}</h2>
          <div className="bg-gold-500 mt-3 h-1 w-14 rounded" />
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((n) => (
              <div key={n} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-navy-900 font-bold">{t(`f${n}t`)}</h3>
                <p className="mt-2 text-sm text-gray-600">{t(`f${n}d`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="industries" className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid items-center gap-8 lg:grid-cols-[260px_1fr]">
            <div>
              <h2 className="text-navy-900 text-2xl font-bold">{t("sectorsTitle")}</h2>
              <div className="bg-gold-500 mt-3 h-1 w-14 rounded" />
            </div>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {sectors.map((n) => (
                <li key={n} className="bg-navy-900 overflow-hidden rounded-xl shadow-md">
                  <Image
                    src={`/brand/sector${n}.png`}
                    alt=""
                    width={234}
                    height={164}
                    className="h-28 w-full object-cover"
                  />
                  <p className="px-3 py-3 text-center font-[family-name:var(--font-display)] text-sm font-bold text-white">
                    {t(`s${n}`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="roadmap" className="border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-navy-900 text-2xl font-bold">{t("roadmapTitle")}</h2>
            <p className="mt-2 max-w-2xl text-gray-600">{t("roadmapDesc")}</p>
            <ol className="mt-8 grid gap-4 md:grid-cols-5">
              {phases.map((n) => (
                <li
                  key={n}
                  className={`rounded-xl border p-4 ${n <= 2 ? "border-gold-500 bg-gold-100/40" : "border-gray-200"}`}
                >
                  <p className="text-gold-600 text-xs font-semibold uppercase">Fase {n}</p>
                  <p className="text-navy-900 mt-1 text-sm">{t(`phase${n}`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="bg-navy-950">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-gray-400">
          <Logo light />
          <span>{t("footer")}</span>
        </div>
      </footer>
    </div>
  );
}
