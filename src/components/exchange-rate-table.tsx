import { getLocale, getTranslations } from "next-intl/server";
import { Badge, EmptyState, Table, Td } from "@/components/ui";
import { formatDate } from "@/lib/utils";

type Rate = {
  id: string;
  organizationId: string | null;
  baseCurrency: string;
  quoteCurrency: string;
  rate: { toString(): string };
  effectiveDate: Date;
  source: string | null;
};

export async function ExchangeRateTable({ rates }: { rates: Rate[] }) {
  const t = await getTranslations("fx");
  const locale = await getLocale();
  if (rates.length === 0) return <EmptyState title={t("empty")} />;
  return (
    <Table head={[t("pair"), t("rate"), t("effectiveDate"), t("source"), t("scope")]}>
      {rates.map((r) => (
        <tr key={r.id}>
          <Td className="font-mono">
            {r.baseCurrency}/{r.quoteCurrency}
          </Td>
          <Td className="font-mono">{r.rate.toString()}</Td>
          <Td>{formatDate(r.effectiveDate, locale)}</Td>
          <Td>{r.source ?? "—"}</Td>
          <Td>
            {r.organizationId ? <Badge tone="gold">{t("own")}</Badge> : <Badge tone="navy">{t("platform")}</Badge>}
          </Td>
        </tr>
      ))}
    </Table>
  );
}
