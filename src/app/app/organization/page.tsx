import { getTranslations } from "next-intl/server";
import { Badge, Card, EmptyState, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { getOrganizationProfile } from "@/modules/org/services/org.service";
import { AddressForm, ContactForm, ProfileForm, RepresentativeForm } from "./forms";
import { RemoveButton } from "./remove-button";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("organization") };
}

export default async function OrganizationPage() {
  const ctx = await requirePagePermission("org.profile.read");
  const t = await getTranslations();
  const org = await getOrganizationProfile(ctx);
  const canEdit = hasPermission(ctx, "org.profile.update");
  const dash = (v: string | null) => v || "—";

  return (
    <>
      <PageHeader
        title={org.name}
        description={t("org.desc")}
        actions={<Badge tone={statusTone(org.status)}>{t(`status.${org.status}`)}</Badge>}
      />
      <Card className="mb-6">
        <h2 className="text-navy-900 mb-1 font-semibold">{t("org.profile")}</h2>
        <p className="mb-4 text-sm text-gray-600">
          {t("org.nif")}: <strong>{org.nif}</strong> · {t(`orgType.${org.type}`)}
        </p>
        {canEdit ? (
          <ProfileForm profile={org} />
        ) : (
          <>
            <p className="mb-3 text-xs text-gray-500">{t("org.readOnly")}</p>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              {(
                [
                  ["org.legalName", org.legalName],
                  ["common.country", org.country],
                  ["common.currency", org.currency],
                  ["org.taxRegime", org.taxRegime],
                  ["org.vatNumber", org.vatNumber],
                  ["common.email", org.email],
                  ["common.phone", org.phone],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-gray-500">{t(k)}</dt>
                  <dd className="text-navy-900">{dash(v)}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="text-navy-900 mb-4 font-semibold">{t("org.addresses")}</h2>
        {org.addresses.length === 0 ? (
          <EmptyState title={t("org.noAddresses")} />
        ) : (
          <Table head={[t("org.addressType"), t("org.line1"), t("org.city"), t("common.country"), ""]}>
            {org.addresses.map((a) => (
              <tr key={a.id}>
                <Td>
                  {t(`org.addrType.${a.type}`)} {a.isPrimary && <Badge tone="gold">{t("common.primary")}</Badge>}
                </Td>
                <Td>
                  {a.line1}
                  {a.line2 && <span className="block text-xs text-gray-500">{a.line2}</span>}
                </Td>
                <Td>
                  {a.city}
                  {a.province && `, ${a.province}`}
                </Td>
                <Td>{a.country}</Td>
                <Td>{canEdit && <RemoveButton id={a.id} kind="address" label={t("common.remove")} />}</Td>
              </tr>
            ))}
          </Table>
        )}
        {canEdit && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <AddressForm />
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="text-navy-900 mb-4 font-semibold">{t("org.contacts")}</h2>
        {org.contacts.length === 0 ? (
          <EmptyState title={t("org.noContacts")} />
        ) : (
          <Table head={[t("common.name"), t("org.contactRole"), t("common.email"), t("common.phone"), ""]}>
            {org.contacts.map((c) => (
              <tr key={c.id}>
                <Td>{c.name}</Td>
                <Td>{dash(c.role)}</Td>
                <Td>{dash(c.email)}</Td>
                <Td>{dash(c.phone)}</Td>
                <Td>{canEdit && <RemoveButton id={c.id} kind="contact" label={t("common.remove")} />}</Td>
              </tr>
            ))}
          </Table>
        )}
        {canEdit && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <ContactForm />
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-navy-900 mb-4 font-semibold">{t("org.representatives")}</h2>
        {org.representatives.length === 0 ? (
          <EmptyState title={t("org.noRepresentatives")} />
        ) : (
          <Table head={[t("common.name"), t("org.position"), t("org.documentNumber"), t("common.email"), ""]}>
            {org.representatives.map((r) => (
              <tr key={r.id}>
                <Td>{r.name}</Td>
                <Td>{dash(r.position)}</Td>
                <Td>{r.documentNumber ? `${r.documentType ?? ""} ${r.documentNumber}` : "—"}</Td>
                <Td>{dash(r.email)}</Td>
                <Td>{canEdit && <RemoveButton id={r.id} kind="representative" label={t("common.remove")} />}</Td>
              </tr>
            ))}
          </Table>
        )}
        {canEdit && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <RepresentativeForm />
          </div>
        )}
      </Card>
    </>
  );
}
