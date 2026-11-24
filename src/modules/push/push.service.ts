import webpush from "web-push";
import { prisma } from "@/lib/db";

export type PushPayload = { title: string; body: string; url: string; tag?: string };
export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string; userAgent?: string | null };

let configured: boolean | null = null;

/** VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY vazios = push desactivado (placeholders do piloto). */
export function pushEnabled(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!pub && !!priv;
  if (configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:pilot@mobilog.ao", pub!, priv!);
  }
  return configured;
}

export const vapidPublicKey = () => (pushEnabled() ? process.env.VAPID_PUBLIC_KEY! : null);

export async function saveSubscription(userId: string, s: PushSubscriptionInput) {
  const data = { userId, p256dh: s.p256dh, auth: s.auth, userAgent: s.userAgent?.slice(0, 300) ?? null };
  return prisma.pushSubscription.upsert({
    where: { endpoint: s.endpoint },
    create: { ...data, endpoint: s.endpoint },
    update: data,
  });
}

export async function removeSubscription(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

/** Envia para todos os dispositivos do utilizador; remove subscrições expiradas (404/410). Nunca lança. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushEnabled()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60, urgency: "high", timeout: 5000 },
        );
        sent++;
        await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410)
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
      }
    }),
  );
  return sent;
}
