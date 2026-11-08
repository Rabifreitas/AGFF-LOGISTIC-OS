import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";

export default async function OrganizationLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePagePermission("org.profile.read");
  const t = await getTranslations("org");
  const tabs = [
    { href: "/app/organization", label: t("profile"), show: true },
    { href: "/app/organization/departments", label: t("departments"), show: true },
    { href: "/app/organization/cost-centers", label: t("costCenters"), show: hasPermission(ctx, "org.cost_centers.read") },
    { href: "/app/organization/settings", label: t("settings"), show: true },
  ];
  return (
    <>
      <nav className="mb-6 flex gap-4 border-b border-gray-200 text-sm">
        {tabs
          .filter((x) => x.show)
          .map((x) => (
            <Link key={x.href} href={x.href} className="-mb-px border-b-2 border-transparent px-1 pb-2 text-gray-600 hover:border-gold-500 hover:text-navy-900">
              {x.label}
            </Link>
          ))}
      </nav>
      {children}
    </>
  );
}
