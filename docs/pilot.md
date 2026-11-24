# Piloto fechado — Luanda (Vercel, planos gratuitos)

Objectivo: algumas empresas e motoristas convidados, pagamento por factura fora da app.
Antes do primeiro cliente real: Vercel Pro (uso comercial, cron por minuto) e base de dados paga.

## Infra

| Peça          | Serviço                                                      | Notas                                                                                         |
| ------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| App           | Vercel, projecto `mobilog-os`, região `fra1`                 | `vercel.json` → `npm run vercel-build`                                                        |
| Base de dados | Neon Postgres (via Vercel Storage)                           | build de produção corre `prisma migrate deploy` + seed de sistema com `DATABASE_URL_UNPOOLED` |
| Documentos    | Vercel Blob privado `mobilog-documents`                      | upload directo do browser (`/api/documents/upload`), o servidor valida tipo, SHA-256 e audita |
| Mapas         | OpenStreetMap: tiles, Nominatim (pesquisa), OSRM (distância) | vazio = sem pesquisa e distância em linha recta × 1,3                                         |
| Alertas       | Web Push (VAPID)                                             | vazio = alertas desligados; o motorista instala a app no ecrã principal                       |
| Cron          | `GET /api/cron/sweep` diário (Hobby)                         | o dispatch também corre em cada leitura das páginas do expedidor/motorista                    |
| Email         | `MAIL_TRANSPORT=log`                                         | emails (convites, recuperação) vão para os logs da Vercel até haver SMTP                      |

## Variáveis (Production)

- `DATABASE_URL`, `DATABASE_URL_UNPOOLED` — criadas pela integração Neon.
- `BLOB_READ_WRITE_TOKEN` — criada pelo Blob store.
- `AUTH_SECRET` (`openssl rand -base64 32`), `AUTH_TRUST_HOST=true`, `APP_URL=https://<projecto>.vercel.app`.
- `CRON_SECRET` — o Vercel Cron envia `Authorization: Bearer $CRON_SECRET`.
- `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_PASSWORD`, `SEED_SUPERADMIN_NAME` — conta AGFF inicial.
- `PILOT_MODE=1`, `MAIL_TRANSPORT=log`, `MAIL_FROM`.
- Mapas: `GEOCODER_URL`, `GEOCODER_EMAIL`, `ROUTING_URL`, `NEXT_PUBLIC_MAP_TILE_URL` (opcionais).
- Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`npx web-push generate-vapid-keys`).

Nunca correr `npm run seed:demo` em produção (recusado salvo `DEMO_ALLOW_PRODUCTION=1`).

## Limites conhecidos do piloto

- Nominatim público: máx. 1 pedido/s, sem autocomplete; moradas em Angola são fracas — o utilizador pode tocar no mapa.
- OSRM de demonstração (`router.project-osrm.org`) não tem SLA; para clientes reais usar um servidor próprio.
- iPhone: alertas só com a app adicionada ao ecrã principal (iOS 16.4+).
- Termos e Privacidade em `/legal/terms` e `/legal/privacy` são rascunhos a rever por advogado.
