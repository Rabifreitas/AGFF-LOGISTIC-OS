import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { requireActor } from "@/modules/iam/session-context";
import { markAllReadAction } from "@/modules/notifications/actions";
import { listMyNotifications } from "@/modules/notifications/notification.service";

export const metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const ctx = await requireActor();
  const t = await getTranslations("notifications");
  const locale = await getLocale();
  const items = await listMyNotifications(ctx);
  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          items.some((n) => !n.readAt) && (
            <form action={markAllReadAction}>
              <Button variant="secondary">{t("markAll")}</Button>
            </form>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {items.map((n) => (
            <li key={n.id} className={`px-4 py-3 ${n.readAt ? "" : "bg-gold-100/40"}`}>
              <div className="flex justify-between gap-4">
                <p className="text-sm font-medium text-navy-900">{n.link ? <Link href={n.link}>{n.title}</Link> : n.title}</p>
                <span className="whitespace-nowrap text-xs text-gray-500">{formatDateTime(n.createdAt, locale)}</span>
              </div>
              {n.body && <p className="text-sm text-gray-600">{n.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
