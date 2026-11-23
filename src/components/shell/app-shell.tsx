import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ModuleIcon } from "@/components/module-icon";
import { Badge, Logo } from "@/components/ui";
import { logoutAction, switchOrganizationAction } from "@/modules/iam/actions";
import { hasPermission, type ActorContext } from "@/modules/iam/rbac";
import { listUserMemberships } from "@/modules/iam/services/member.service";
import { countUnread } from "@/modules/notifications/notification.service";
import { MODULES } from "@/modules/registry";

export type NavItem = { href: string; label: string; badge?: number; icon?: string };

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
  const operationsHref = ["shipments", "driver", "freight", "marketplace"]
    .map((key) => nav.find((item) => item.icon === key)?.href)
    .find(Boolean);
  return (
    <div className="flex min-h-screen">
      <aside className="bg-navy-900 hidden w-64 shrink-0 flex-col text-gray-200 md:flex">
        <div className="px-5 py-5">
          <Link href="/app">
            <Logo light />
          </Link>
          {title && <p className="text-gold-500 mt-2 text-xs tracking-wider uppercase">{title}</p>}
        </div>
        <nav className="flex-1 space-y-1 px-3 pb-6" aria-label="Main">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:bg-navy-800 flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:text-white"
            >
              <span className="flex items-center gap-3">
                <ModuleIcon name={item.icon ?? "dashboard"} className="text-gold-500 h-4 w-4" />
                {item.label}
              </span>
              {!!item.badge && (
                <span className="bg-gold-500 text-navy-950 rounded-full px-2 text-xs font-semibold">{item.badge}</span>
              )}
            </Link>
          ))}
        </nav>
        {ctx.isPlatform && hasPermission(ctx, "platform.access") && (
          <div className="border-navy-800 border-t px-3 py-3">
            <Link href="/admin" className="text-gold-500 hover:bg-navy-800 block rounded-md px-3 py-2 text-sm">
              {t("nav.admin")}
            </Link>
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="bg-navy-900 flex items-center justify-between px-4 py-3 md:hidden">
          <Link href="/app">
            <Logo light />
          </Link>
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <LocaleSwitcher light />
            <Link href="/app/notifications" className="relative text-white" aria-label={t("nav.notifications")}>
              <ModuleIcon name="alerts" />
              {unread > 0 && <span className="bg-gold-500 absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full" />}
            </Link>
            <form action={logoutAction}>
              <button className="hover:text-white">{t("nav.logout")}</button>
            </form>
          </div>
        </div>
        <header className="hidden flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3 md:flex">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-navy-900 font-medium">{ctx.organizationName}</span>
            <Badge tone="navy">{t(`roles.${ctx.roleKey}`)}</Badge>
            {activeOrgs.length > 1 && (
              <form action={switchOrganizationAction} className="flex items-center gap-2">
                <select
                  name="organizationId"
                  defaultValue={ctx.organizationId}
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                  aria-label={t("nav.switchOrg")}
                >
                  {activeOrgs.map((m) => (
                    <option key={m.organizationId} value={m.organizationId}>
                      {m.organization.name}
                    </option>
                  ))}
                </select>
                <button className="text-navy-700 text-xs hover:underline">{t("nav.switchOrg")}</button>
              </form>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/app/notifications" className="hover:text-navy-900 text-gray-600">
              {t("nav.notifications")}
              {unread > 0 && (
                <span className="bg-gold-500 text-navy-950 ml-1 rounded-full px-1.5 text-xs font-semibold">
                  {unread}
                </span>
              )}
            </Link>
            <Link href="/account" className="hover:text-navy-900 text-gray-600">
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
            <Link key={item.href} href={item.href} className="text-navy-900 whitespace-nowrap">
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 px-4 py-6 pb-28 md:px-6 md:py-8">{children}</main>
        <nav
          aria-label={t("nav.home")}
          className="bg-navy-900 fixed inset-x-0 bottom-0 z-40 grid auto-cols-fr grid-flow-col border-t border-white/10 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
        >
          {[
            { href: "/app", label: t("nav.home"), icon: "home" },
            ...(operationsHref ? [{ href: operationsHref, label: t("nav.operations"), icon: "operations" }] : []),
            { href: "/app/notifications", label: t("nav.alerts"), icon: "alerts" },
            { href: "/account", label: t("nav.profile"), icon: "profile" },
          ].map((b) => (
            <Link
              key={b.href}
              href={b.href}
              className="hover:text-gold-300 flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] text-gray-300"
            >
              <ModuleIcon name={b.icon} className="h-5 w-5" />
              {b.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export async function companyNav(ctx: ActorContext): Promise<NavItem[]> {
  const t = await getTranslations("nav");
  const items: NavItem[] = [{ href: "/app", label: t("dashboard"), icon: "dashboard" }];
  for (const m of MODULES) {
    if (m.status === "active" && m.href && (!m.permission || hasPermission(ctx, m.permission))) {
      items.push({ href: m.href, label: t(m.key), icon: m.key });
    }
  }
  return items;
}
