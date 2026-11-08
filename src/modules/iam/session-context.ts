import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getRequestMeta } from "@/lib/request-meta";
import { loadActorContext, defaultOrganizationId } from "./context-loader";
import type { Permission } from "./permissions";
import { hasPermission, type ActorContext } from "./rbac";
import { validateSession } from "./services/session.service";

/** Sessão autenticada validada contra a BD (não revogada / não expirada). */
export const getCurrentSession = cache(async () => {
  const s = await auth();
  const sessionId = (s as { sessionId?: string } | null)?.sessionId;
  if (!sessionId) return null;
  return validateSession(sessionId);
});

/** Contexto do actor na organização activa da sessão. */
export const getActorContext = cache(async (): Promise<ActorContext | null> => {
  const session = await getCurrentSession();
  if (!session) return null;
  const meta = await getRequestMeta();
  let orgId = session.activeOrganizationId;
  let ctx = orgId ? await loadActorContext(session.userId, orgId, { sessionId: session.id, ...meta }) : null;
  if (!ctx) {
    orgId = await defaultOrganizationId(session.userId);
    if (!orgId) return null;
    await prisma.session.update({ where: { id: session.id }, data: { activeOrganizationId: orgId } });
    ctx = await loadActorContext(session.userId, orgId, { sessionId: session.id, ...meta });
  }
  return ctx;
});

/** Para páginas: exige autenticação (redirect /login). */
export async function requireActor(): Promise<ActorContext> {
  const ctx = await getActorContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Para páginas da área empresarial: exige organização activa. */
export async function requireActiveOrgActor(): Promise<ActorContext> {
  const ctx = await requireActor();
  if (ctx.organizationStatus !== "ACTIVE") redirect("/app/pending");
  return ctx;
}

/** Para páginas: exige permissão; caso contrário mostra 403. */
export async function requirePagePermission(permission: Permission): Promise<ActorContext> {
  const ctx = await requireActiveOrgActor();
  if (!hasPermission(ctx, permission)) redirect("/app/forbidden");
  return ctx;
}
