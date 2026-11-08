import { AppShell, companyNav } from "@/components/shell/app-shell";
import { requireActor } from "@/modules/iam/session-context";

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireActor();
  return (
    <AppShell ctx={ctx} nav={ctx.organizationStatus === "ACTIVE" ? await companyNav(ctx) : []}>
      {children}
    </AppShell>
  );
}
