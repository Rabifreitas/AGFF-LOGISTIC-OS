import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Badge, Logo } from "@/components/ui";
import { logoutAction, switchOrganizationAction } from "@/modules/iam/actions";
import { hasPermission, type ActorContext } from "@/modules/iam/rbac";
import { listUserMemberships } from "@/modules/iam/services/member.service";
import { countUnread } from "@/modules/notifications/notification.service";
import { MODULES } from "@/modules/registry";

export type NavItem = { href: string; label: string; badge?: number };

export async function AppShell({
  ctx,
  nav,
  title,
  children,
}: {
  ctx: ActorContext;
  nav: NavItem[];
  title?: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  const [memberships, unread] = await Promise.all([listUserMemberships(ctx.userId), countUnread(ctx)]);
  const activeOrgs = memberships.filter((m) => m.status === "ACTIVE");
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-900 text-gray-200 md:flex">
        <div className="px-5 py-5">
          <Link href="/app">
            <Logo light />
          </Link>
          {title && <p className="mt-2 text-xs uppercase tracking-wider text-gold-500">{title}</p>}
        </div>
        <nav className="flex-1 space-y-1 px-3 pb-6" aria-label="Main">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-navy-800 hover:text-white">
              <span>{item.label}</span>
              {!!item.badge && <span className="rounded-full bg-gold-500 px-2 text-xs font-semibold text-navy-950">{item.badge}</span>}
            </Link>
          ))}
        </nav>
        {ctx.isPlatform && hasPermission(ctx, "platform.access") && (
          <div className="border-t border-navy-800 px-3 py-3">
            <Link href="/admin" className="block rounded-md px-3 py-2 text-sm text-gold-500 hover:bg-navy-800">
              {t("nav.admin")}
            </Link>
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium text-navy-900">{ctx.organizationName}</span>
            <Badge tone="navy">{t(`roles.${ctx.roleKey}`)}</Badge>
            {activeOrgs.length > 1 && (
              <form action={switchOrganizationAction} className="flex items-center gap-2">
                <select name="organizationId" defaultValue={ctx.organizationId} className="rounded border border-gray-300 px-2 py-1 text-xs" aria-label={t("nav.switchOrg")}>
                  {activeOrgs.map((m) => (
                    <option key={m.organizationId} value={m.organizationId}>
                      {m.organization.name}
                    </option>
                  ))}
                </select>
                <button className="text-xs text-navy-700 hover:underline">{t("nav.switchOrg")}</button>
              </form>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/app/notifications" className="text-gray-600 hover:text-navy-900">
              {t("nav.notifications")}
              {unread > 0 && <span className="ml-1 rounded-full bg-gold-500 px-1.5 text-xs font-semibold text-navy-950">{unread}</span>}
            </Link>
            <Link href="/account" className="text-gray-600 hover:text-navy-900">
              {ctx.name}
            </Link>
            <LocaleSwitcher />
            <form action={logoutAction}>
              <button className="text-gray-600 hover:text-red-700">{t("nav.logout")}</button>
            </form>
          </div>
        </header>
        <nav className="flex gap-3 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2 text-sm md:hidden">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap text-navy-900">
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

export async function companyNav(ctx: ActorContext): Promise<NavItem[]> {
  const t = await getTranslations("nav");
  const items: NavItem[] = [{ href: "/app", label: t("dashboard") }];
  for (const m of MODULES) {
    if (m.status === "active" && m.href && (!m.permission || hasPermission(ctx, m.permission))) {
      items.push({ href: m.href, label: t(m.key) });
    }
  }
  return items;
}
