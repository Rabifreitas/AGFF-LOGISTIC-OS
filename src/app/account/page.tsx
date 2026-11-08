import { getLocale, getTranslations } from "next-intl/server";
import { Badge, Button, Card, EmptyState, PageHeader, Table, Td } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { revokeOtherSessionsAction, revokeSessionAction } from "@/modules/iam/actions";
import { requireActor } from "@/modules/iam/session-context";
import { listUserAccessLog } from "@/modules/iam/services/access-log.service";
import { listActiveSessions } from "@/modules/iam/services/session.service";
import { PasswordForm } from "./password-form";

export const metadata = { title: "A minha conta" };

export default async function AccountPage() {
  const ctx = await requireActor();
  const t = await getTranslations();
  const locale = await getLocale();
  const [sessions, accessLog] = await Promise.all([listActiveSessions(ctx.userId), listUserAccessLog(ctx.userId, 30)]);
  return (
    <>
      <PageHeader title={t("account.title")} description={`${ctx.name} · ${ctx.email}`} />
      <Card className="mb-6">
        <h2 className="text-navy-900 mb-4 font-semibold">{t("account.password")}</h2>
        <PasswordForm />
      </Card>
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-navy-900 font-semibold">{t("account.mfa")}</h2>
          <Badge tone="yellow">{t("account.mfaPending")}</Badge>
        </div>
      </Card>
      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-navy-900 font-semibold">{t("account.sessions")}</h2>
          {sessions.length > 1 && (
            <form action={revokeOtherSessionsAction}>
              <Button variant="secondary">{t("account.revokeOthers")}</Button>
            </form>
          )}
        </div>
        <Table head={[t("account.device"), t("account.ip"), t("account.started"), t("account.lastSeen"), ""]}>
          {sessions.map((s) => (
            <tr key={s.id}>
              <Td className="max-w-xs truncate text-xs">{s.userAgent ?? "—"}</Td>
              <Td className="text-xs">{s.ipAddress ?? "—"}</Td>
              <Td className="text-xs">{formatDateTime(s.createdAt, locale)}</Td>
              <Td className="text-xs">{formatDateTime(s.lastSeenAt, locale)}</Td>
              <Td>
                {s.id === ctx.sessionId ? (
                  <Badge tone="green">{t("account.current")}</Badge>
                ) : (
                  <form action={revokeSessionAction}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <button className="text-xs text-red-700 hover:underline">{t("account.revoke")}</button>
                  </form>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card>
        <h2 className="text-navy-900 mb-4 font-semibold">{t("account.accessLog")}</h2>
        {accessLog.length === 0 ? (
          <EmptyState title={t("account.noAccess")} />
        ) : (
          <Table head={[t("common.date"), t("account.event"), t("account.result"), t("account.ip")]}>
            {accessLog.map((a) => (
              <tr key={a.id}>
                <Td className="text-xs">{formatDateTime(a.createdAt, locale)}</Td>
                <Td>
                  <code className="text-xs">{a.event}</code>
                </Td>
                <Td>
                  <Badge tone={a.success ? "green" : "red"}>
                    {a.success ? t("account.success") : t("account.failure")}
                  </Badge>
                  {a.reason && <span className="ml-1 text-xs text-gray-500">{a.reason}</span>}
                </Td>
                <Td className="text-xs">{a.ipAddress ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
