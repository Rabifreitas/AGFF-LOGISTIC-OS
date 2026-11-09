import { getLocale, getTranslations } from "next-intl/server";
import { Badge, Card, EmptyState, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { changeRoleAction, revokeInviteAction, setMemberStatusAction } from "@/modules/iam/actions";
import { assignableRoleKeys, hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { listInvites } from "@/modules/iam/services/invite.service";
import { listMembers, listRolesWithPermissions } from "@/modules/iam/services/member.service";
import { InviteForm } from "./invite-form";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("team") };
}

export default async function TeamPage() {
  const ctx = await requirePagePermission("iam.members.read");
  const t = await getTranslations();
  const locale = await getLocale();
  const [members, invites, roles] = await Promise.all([
    listMembers(ctx),
    listInvites(ctx),
    hasPermission(ctx, "iam.roles.read") ? listRolesWithPermissions(ctx) : Promise.resolve([]),
  ]);
  const assignable = assignableRoleKeys(ctx);
  const canInvite = hasPermission(ctx, "iam.members.invite");
  const canUpdate = hasPermission(ctx, "iam.members.update");
  const canSuspend = hasPermission(ctx, "iam.members.suspend");

  return (
    <>
      <PageHeader title={t("team.title")} description={t("team.desc")} />
      {canInvite && (
        <Card className="mb-8">
          <h2 className="text-navy-900 mb-4 font-semibold">{t("team.invite")}</h2>
          <InviteForm roles={assignable} />
        </Card>
      )}

      <h2 className="text-navy-900 mb-3 font-semibold">{t("team.members")}</h2>
      <Table head={[t("common.name"), t("team.role"), t("common.status"), t("team.lastLogin"), t("common.actions")]}>
        {members.map((m) => {
          const self = m.userId === ctx.userId;
          const editable = !self && (assignable as string[]).includes(m.role.key);
          return (
            <tr key={m.id}>
              <Td>
                <p className="text-navy-900 font-medium">
                  {m.user.name} {self && <span className="text-gray-400">{t("team.you")}</span>}
                </p>
                <p className="text-xs text-gray-500">{m.user.email}</p>
              </Td>
              <Td>
                {canUpdate && editable ? (
                  <form action={changeRoleAction} className="flex gap-2">
                    <input type="hidden" name="membershipId" value={m.id} />
                    <select
                      name="roleKey"
                      defaultValue={m.role.key}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                      aria-label={t("team.role")}
                    >
                      {assignable.map((r) => (
                        <option key={r} value={r}>
                          {t(`roles.${r}`)}
                        </option>
                      ))}
                    </select>
                    <button className="text-navy-700 text-xs hover:underline">{t("team.changeRole")}</button>
                  </form>
                ) : (
                  t(`roles.${m.role.key}`)
                )}
              </Td>
              <Td>
                <Badge tone={statusTone(m.status)}>{t(`status.${m.status}`)}</Badge>
              </Td>
              <Td className="text-xs text-gray-600">{formatDateTime(m.user.lastLoginAt, locale)}</Td>
              <Td>
                {canSuspend && editable && (
                  <form action={setMemberStatusAction}>
                    <input type="hidden" name="membershipId" value={m.id} />
                    <input type="hidden" name="status" value={m.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} />
                    <button
                      className={
                        m.status === "ACTIVE"
                          ? "text-xs text-red-700 hover:underline"
                          : "text-xs text-green-700 hover:underline"
                      }
                    >
                      {m.status === "ACTIVE" ? t("team.suspend") : t("team.reactivate")}
                    </button>
                  </form>
                )}
              </Td>
            </tr>
          );
        })}
      </Table>

      <h2 className="text-navy-900 mt-8 mb-3 font-semibold">{t("team.invites")}</h2>
      {invites.length === 0 ? (
        <EmptyState title={t("team.noInvites")} />
      ) : (
        <Table head={[t("common.email"), t("team.role"), t("team.expires"), t("common.actions")]}>
          {invites.map((i) => (
            <tr key={i.id}>
              <Td>{i.email}</Td>
              <Td>{t(`roles.${i.role.key}`)}</Td>
              <Td className="text-xs text-gray-600">{formatDateTime(i.expiresAt, locale)}</Td>
              <Td>
                {canInvite && (
                  <form action={revokeInviteAction}>
                    <input type="hidden" name="inviteId" value={i.id} />
                    <button className="text-xs text-red-700 hover:underline">{t("team.revoke")}</button>
                  </form>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {roles.length > 0 && (
        <>
          <h2 className="text-navy-900 mt-8 mb-3 font-semibold">{t("team.rolesTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => (
              <details key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <summary className="text-navy-900 cursor-pointer text-sm font-medium">
                  {t(`roles.${r.key}`)}{" "}
                  <span className="text-xs text-gray-500">
                    · {t("team.permissionsCount", { n: r.permissions.length })}
                  </span>
                </summary>
                <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
                  {r.permissions.map((p) => (
                    <li key={p.permissionId}>
                      <code>{p.permission.key}</code>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </>
      )}
    </>
  );
}
