import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { hasPermission } from "@/modules/iam/rbac";
import { requireActor } from "@/modules/iam/session-context";
import { pendingApprovalCount } from "@/modules/platform/services/platform.service";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireActor();
  if (!ctx.isPlatform || !hasPermission(ctx, "platform.access")) redirect("/app/forbidden");
  const t = await getTranslations("nav");
  const pending = hasPermission(ctx, "platform.organizations.read") ? await pendingApprovalCount(ctx) : 0;
  const nav = [
    { href: "/admin", label: t("organizations"), badge: pending, perm: "platform.organizations.read" as const },
    { href: "/admin/users", label: t("users"), perm: "platform.users.read" as const },
    { href: "/admin/audit", label: t("audit"), perm: "platform.audit.read" as const },
    { href: "/admin/exchange-rates", label: t("exchangeRates"), perm: "platform.exchange_rates.manage" as const },
  ].filter((i) => hasPermission(ctx, i.perm));
  return (
    <AppShell ctx={ctx} nav={[...nav, { href: "/app", label: t("backToApp") }]} title={t("admin")}>
      {children}
    </AppShell>
  );
}
