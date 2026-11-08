import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Badge, Button, EmptyState, Input, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { hasPermission } from "@/modules/iam/rbac";
import { requireActor } from "@/modules/iam/session-context";
import { setUserLockAction } from "@/modules/platform/actions";
import { listUsers } from "@/modules/platform/services/platform.service";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireActor();
  if (!hasPermission(ctx, "platform.users.read")) redirect("/app/forbidden");
  const t = await getTranslations();
  const locale = await getLocale();
  const { q } = await searchParams;
  const users = await listUsers(ctx, q);
  const canLock = hasPermission(ctx, "platform.users.lock");
  return (
    <>
      <PageHeader title={t("nav.users")} description={t("admin.usersDesc")} />
      <form className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q} placeholder={t("common.search")} className="max-w-xs" aria-label={t("common.search")} />
        <Button variant="secondary">{t("common.search")}</Button>
      </form>
      {users.length === 0 ? (
        <EmptyState title={t("admin.noUsers")} />
      ) : (
        <Table head={[t("common.name"), t("admin.memberships"), t("common.status"), t("admin.lastLogin"), t("common.actions")]}>
          {users.map((u) => {
            const locked = u.status === "LOCKED";
            return (
              <tr key={u.id}>
                <Td>
                  {u.name}
                  <span className="block text-xs text-gray-500">{u.email}</span>
                </Td>
                <Td className="text-xs">
                  {u.memberships.map((m) => (
                    <span key={m.organization.name + m.role.key} className="block">
                      {m.organization.name} · {t(`roles.${m.role.key}`)}
                    </span>
                  ))}
                </Td>
                <Td>
                  <Badge tone={statusTone(u.status)}>{t(`status.${u.status}`)}</Badge>
                  {u.lockedUntil && u.lockedUntil > new Date() && <span className="ml-1 text-xs text-red-600">⏱</span>}
                </Td>
                <Td className="text-xs">{formatDateTime(u.lastLoginAt, locale)}</Td>
                <Td>
                  {canLock && u.id !== ctx.userId && (
                    <form action={setUserLockAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="locked" value={String(!locked)} />
                      <button className={locked ? "text-xs text-green-700 hover:underline" : "text-xs text-red-700 hover:underline"}>
                        {locked ? t("admin.unlock") : t("admin.lock")}
                      </button>
                    </form>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
