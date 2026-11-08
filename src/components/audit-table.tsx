import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState, Table, Td } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

type Row = {
  id: string;
  createdAt: Date;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  user: { name: string; email: string } | null;
  organization?: { name: string } | null;
};

function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-gray-400">—</span>;
  return (
    <pre className="max-h-48 max-w-xs overflow-auto rounded bg-gray-50 p-2 text-[11px] break-all whitespace-pre-wrap">
      {JSON.stringify(value, null, 1)}
    </pre>
  );
}

export async function AuditTable({ rows, showOrganization = false }: { rows: Row[]; showOrganization?: boolean }) {
  const t = await getTranslations("audit");
  const locale = await getLocale();
  if (rows.length === 0) return <EmptyState title={t("empty")} />;
  const head = [
    t("date"),
    t("user"),
    ...(showOrganization ? [t("organization")] : []),
    t("action"),
    t("entity"),
    t("before"),
    t("after"),
  ];
  return (
    <Table head={head}>
      {rows.map((r) => (
        <tr key={r.id}>
          <Td className="text-xs whitespace-nowrap text-gray-600">
            {formatDateTime(r.createdAt, locale)}
            {r.ipAddress && <span className="block text-gray-400">{r.ipAddress}</span>}
          </Td>
          <Td className="text-xs">{r.user ? `${r.user.name} <${r.user.email}>` : t("system")}</Td>
          {showOrganization && <Td className="text-xs">{r.organization?.name ?? "—"}</Td>}
          <Td>
            <code className="text-xs">{r.action}</code>
          </Td>
          <Td className="text-xs">
            {r.entityType}
            {r.entityId && <span className="block font-mono text-[10px] text-gray-400">{r.entityId}</span>}
          </Td>
          <Td>
            <Json value={r.before} />
          </Td>
          <Td>
            <Json value={r.after} />
          </Td>
        </tr>
      ))}
    </Table>
  );
}
