/**
 * Catálogo de permissões e matriz dos 11 perfis da especificação.
 * Fonte de verdade em código; o seed sincroniza estas definições para as
 * tabelas roles / permissions / role_permissions. Verificação sempre no servidor.
 */

export const PERMISSIONS = {
  // Plataforma (operador AGFF)
  "platform.access": "Aceder ao painel de administração da plataforma",
  "platform.organizations.read": "Ver todas as organizações",
  "platform.organizations.approve": "Aprovar/rejeitar registos de empresas",
  "platform.organizations.suspend": "Suspender/reactivar empresas",
  "platform.users.read": "Ver todos os utilizadores",
  "platform.users.lock": "Bloquear/desbloquear contas de utilizador",
  "platform.audit.read": "Ver audit log global",
  "platform.exchange_rates.manage": "Gerir taxas de câmbio de referência",

  // ORG (Módulo 02)
  "org.profile.read": "Ver dados da empresa",
  "org.profile.update": "Editar dados fiscais, endereços, contactos e representantes",
  "org.departments.manage": "Gerir departamentos",
  "org.cost_centers.read": "Ver centros de custo",
  "org.cost_centers.manage": "Gerir centros de custo",
  "org.settings.manage": "Gerir configurações da empresa",

  // IAM (Módulo 01)
  "iam.members.read": "Ver utilizadores da empresa",
  "iam.members.invite": "Convidar utilizadores",
  "iam.members.update": "Alterar perfil de utilizadores",
  "iam.members.suspend": "Suspender/reactivar utilizadores da empresa",
  "iam.roles.read": "Ver perfis e permissões",

  // Transversal
  "audit.read": "Ver audit log da empresa",
  "exchange_rates.read": "Ver taxas de câmbio",

  // Fase 2+ (reservadas; ainda sem UI)
  "mkt.quotations.read": "Ver cotações",
  "mkt.quotations.manage": "Criar/gerir cotações",
  "mkt.partners.read": "Ver parceiros",
  "mkt.partners.manage": "Gerir parceiros",
  "tms.shipments.read": "Ver expedições",
  "tms.shipments.manage": "Criar/gerir expedições",
  "trk.events.read": "Ver eventos de tracking",
  "trk.events.create": "Registar eventos de tracking",
  "dms.documents.read": "Ver documentos",
  "dms.documents.manage": "Carregar/gerir documentos",
  "dms.documents.approve": "Aprovar documentos",
  "sup.procurement.read": "Ver procurement",
  "sup.procurement.manage": "Gerir procurement",
  "fin.invoices.read": "Ver financeiro",
  "fin.invoices.manage": "Gerir financeiro",
  "fin.exchange_rates.manage": "Gerir taxas de câmbio próprias da empresa",
  "incidents.read": "Ver incidentes",
  "incidents.manage": "Gerir incidentes",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const permissionModule = (p: Permission) => p.split(".")[0];

export const ROLE_KEYS = [
  "SUPER_ADMIN",
  "PLATFORM_OPERATIONS",
  "COMPANY_ADMIN",
  "LOGISTICS_MANAGER",
  "PROCUREMENT_OFFICER",
  "DOCUMENT_CONTROLLER",
  "FINANCE_OFFICER",
  "TRANSPORTER_ADMIN",
  "DRIVER",
  "CUSTOMER",
  "AUDITOR",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];
export type RoleScopeKey = "PLATFORM" | "ORGANIZATION";

export type RoleDefinition = {
  key: RoleKey;
  name: string;
  scope: RoleScopeKey;
  description: string;
  permissions: readonly Permission[];
};

const readOnly = ALL_PERMISSIONS.filter(
  (p) => !p.startsWith("platform.") && (p.endsWith(".read") || p === "audit.read"),
);
const businessAll = ALL_PERMISSIONS.filter((p) => !p.startsWith("platform."));

export const ROLE_DEFINITIONS: Record<RoleKey, RoleDefinition> = {
  SUPER_ADMIN: {
    key: "SUPER_ADMIN",
    name: "Super Administrator",
    scope: "PLATFORM",
    description: "Controlo total da plataforma.",
    permissions: ALL_PERMISSIONS,
  },
  PLATFORM_OPERATIONS: {
    key: "PLATFORM_OPERATIONS",
    name: "Platform Operations",
    scope: "PLATFORM",
    description: "Operação diária: aprovação de empresas, suporte e monitorização.",
    permissions: [
      "platform.access",
      "platform.organizations.read",
      "platform.organizations.approve",
      "platform.organizations.suspend",
      "platform.users.read",
      "platform.audit.read",
      "exchange_rates.read",
    ],
  },
  COMPANY_ADMIN: {
    key: "COMPANY_ADMIN",
    name: "Company Administrator",
    scope: "ORGANIZATION",
    description: "Administra a empresa: dados, utilizadores, perfis e configurações.",
    permissions: businessAll,
  },
  LOGISTICS_MANAGER: {
    key: "LOGISTICS_MANAGER",
    name: "Logistics Manager",
    scope: "ORGANIZATION",
    description: "Planeia e acompanha expedições, transportes e incidentes.",
    permissions: [
      "org.profile.read",
      "org.cost_centers.read",
      "iam.members.read",
      "exchange_rates.read",
      "mkt.quotations.read",
      "mkt.quotations.manage",
      "mkt.partners.read",
      "tms.shipments.read",
      "tms.shipments.manage",
      "trk.events.read",
      "trk.events.create",
      "dms.documents.read",
      "dms.documents.manage",
      "incidents.read",
      "incidents.manage",
    ],
  },
  PROCUREMENT_OFFICER: {
    key: "PROCUREMENT_OFFICER",
    name: "Procurement Officer",
    scope: "ORGANIZATION",
    description: "Pedidos de cotação, fornecedores e compras de serviços logísticos.",
    permissions: [
      "org.profile.read",
      "org.cost_centers.read",
      "exchange_rates.read",
      "mkt.quotations.read",
      "mkt.quotations.manage",
      "mkt.partners.read",
      "mkt.partners.manage",
      "sup.procurement.read",
      "sup.procurement.manage",
      "dms.documents.read",
    ],
  },
  DOCUMENT_CONTROLLER: {
    key: "DOCUMENT_CONTROLLER",
    name: "Document Controller",
    scope: "ORGANIZATION",
    description: "Gestão documental: carregamento, versões e aprovação.",
    permissions: [
      "org.profile.read",
      "tms.shipments.read",
      "dms.documents.read",
      "dms.documents.manage",
      "dms.documents.approve",
    ],
  },
  FINANCE_OFFICER: {
    key: "FINANCE_OFFICER",
    name: "Finance Officer",
    scope: "ORGANIZATION",
    description: "Facturação, pagamentos, centros de custo e câmbios.",
    permissions: [
      "org.profile.read",
      "org.cost_centers.read",
      "org.cost_centers.manage",
      "exchange_rates.read",
      "fin.invoices.read",
      "fin.invoices.manage",
      "fin.exchange_rates.manage",
      "mkt.quotations.read",
      "tms.shipments.read",
      "dms.documents.read",
    ],
  },
  TRANSPORTER_ADMIN: {
    key: "TRANSPORTER_ADMIN",
    name: "Transporter Administrator",
    scope: "ORGANIZATION",
    description: "Gere a frota, motoristas e serviços de uma transportadora.",
    permissions: [
      "org.profile.read",
      "iam.members.read",
      "iam.members.invite",
      "exchange_rates.read",
      "mkt.quotations.read",
      "mkt.quotations.manage",
      "tms.shipments.read",
      "trk.events.read",
      "trk.events.create",
      "dms.documents.read",
      "dms.documents.manage",
      "incidents.read",
      "incidents.manage",
    ],
  },
  DRIVER: {
    key: "DRIVER",
    name: "Driver",
    scope: "ORGANIZATION",
    description: "Executa transportes e regista eventos de tracking.",
    permissions: ["tms.shipments.read", "trk.events.read", "trk.events.create", "incidents.manage"],
  },
  CUSTOMER: {
    key: "CUSTOMER",
    name: "Customer",
    scope: "ORGANIZATION",
    description: "Cliente final: acompanha expedições, cotações e documentos.",
    permissions: [
      "org.profile.read",
      "mkt.quotations.read",
      "tms.shipments.read",
      "trk.events.read",
      "dms.documents.read",
    ],
  },
  AUDITOR: {
    key: "AUDITOR",
    name: "Auditor",
    scope: "ORGANIZATION",
    description: "Acesso só de leitura, incluindo audit log.",
    permissions: readOnly,
  },
};

export const ORGANIZATION_ROLE_KEYS = ROLE_KEYS.filter((k) => ROLE_DEFINITIONS[k].scope === "ORGANIZATION");
export const PLATFORM_ROLE_KEYS = ROLE_KEYS.filter((k) => ROLE_DEFINITIONS[k].scope === "PLATFORM");

export function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value);
}
