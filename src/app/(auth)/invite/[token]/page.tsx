import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, buttonClass } from "@/components/ui";
import { getCurrentSession } from "@/modules/iam/session-context";
import { getInviteByToken } from "@/modules/iam/services/invite.service";
import { ExistingUserInviteForm, NewUserInviteForm } from "./invite-forms";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations();
  const invite = await getInviteByToken(token);
  const session = invite?.userExists ? await getCurrentSession() : null;
  return (
    <Card className="w-full max-w-md">
      <h1 className="mb-2 text-xl font-semibold text-navy-900">{t("invites.title")}</h1>
      {!invite ? (
        <p className="text-sm text-red-700">{t("invites.invalid")}</p>
      ) : (
        <>
          <p className="mb-6 text-sm text-gray-600">
            {t("invites.invitedTo", { org: invite.organization.name, role: t(`roles.${invite.role.key}`) })}
          </p>
          {!invite.userExists ? (
            <NewUserInviteForm token={token} email={invite.email} />
          ) : session ? (
            <ExistingUserInviteForm token={token} />
          ) : (
            <>
              <p className="mb-4 text-sm text-gray-600">{t("invites.loginToAccept")}</p>
              <Link href={`/login?next=/invite/${token}`} className={buttonClass("primary")}>
                {t("invites.signInFirst")}
              </Link>
            </>
          )}
        </>
      )}
    </Card>
  );
}
