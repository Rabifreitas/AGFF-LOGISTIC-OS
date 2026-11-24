import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Logo } from "@/components/ui";

const DOCS = ["terms", "privacy"] as const;
type Doc = (typeof DOCS)[number];
type Section = { h: string; p: string };

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!DOCS.includes(doc as Doc)) return {};
  const t = await getTranslations("legal");
  return { title: t(`${doc as Doc}.title`) };
}

/** Rascunhos de Termos e Privacidade do piloto fechado — a rever por advogado antes do lançamento. */
export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!DOCS.includes(doc as Doc)) notFound();
  const t = await getTranslations("legal");
  const sections = t.raw(`${doc}.sections`) as Section[];
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-navy-950 px-6 py-4">
        <Link href="/">
          <Logo light />
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("draft")}
        </p>
        <h1 className="font-display text-navy-950 text-3xl font-bold">{t(`${doc}.title`)}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("updated")}</p>
        <div className="mt-8 space-y-6">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-navy-950 text-lg font-semibold">{s.h}</h2>
              <p className="mt-1 leading-relaxed whitespace-pre-line text-gray-700">{s.p}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
