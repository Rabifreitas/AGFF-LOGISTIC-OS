import type { Permission } from "@/modules/iam/permissions";

export type ModuleEntry = {
  code: string;
  key: string;
  href?: string;
  permission?: Permission;
  phase: number;
  status: "active" | "planned";
};

/** Navegação por módulos (monólito modular). Módulos "planned" aparecem como "Em breve". */
export const MODULES: ModuleEntry[] = [
  { code: "IAM", key: "team", href: "/app/team", permission: "iam.members.read", phase: 1, status: "active" },
  {
    code: "ORG",
    key: "organization",
    href: "/app/organization",
    permission: "org.profile.read",
    phase: 1,
    status: "active",
  },
  { code: "AUD", key: "audit", href: "/app/audit", permission: "audit.read", phase: 1, status: "active" },
  {
    code: "FX",
    key: "exchangeRates",
    href: "/app/exchange-rates",
    permission: "exchange_rates.read",
    phase: 1,
    status: "active",
  },
  {
    code: "PRT",
    key: "partners",
    href: "/app/partners",
    permission: "mkt.partners.read",
    phase: 2,
    status: "active",
  },
  {
    code: "SHP",
    key: "shipments",
    href: "/app/shipments",
    permission: "tms.shipments.read",
    phase: 2,
    status: "active",
  },
  { code: "TRK", key: "tracking", href: "/app/tracking", permission: "trk.events.read", phase: 2, status: "active" },
  {
    code: "INC",
    key: "incidents",
    href: "/app/incidents",
    permission: "incidents.read",
    phase: 2,
    status: "active",
  },
  { code: "MKT", key: "marketplace", permission: "mkt.quotations.read", phase: 2, status: "planned" },
  {
    code: "DMS",
    key: "documents",
    href: "/app/documents",
    permission: "dms.documents.read",
    phase: 2,
    status: "active",
  },
  { code: "TMS", key: "transport", permission: "tms.shipments.read", phase: 2, status: "planned" },
  { code: "SUP", key: "procurement", permission: "sup.procurement.read", phase: 3, status: "planned" },
  { code: "FIN", key: "finance", permission: "fin.invoices.read", phase: 3, status: "planned" },
];
