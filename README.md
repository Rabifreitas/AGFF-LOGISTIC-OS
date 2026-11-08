# AGFF Logistics OS

Plataforma logística multiempresa (multi-tenant) para Angola, com expansão africana: marketplace, SaaS de gestão logística, gestão documental, tracking e financeiro.

Este repositório contém a **Fase 1 — Foundation**: identidade e acessos (IAM), empresas (ORG), RBAC com 11 perfis, isolamento multi-tenant, auditoria, câmbios, notificações e o esquema de dados da Fase 2 (só tabelas). Ver [roadmap.md](roadmap.md).

## Stack

Next.js 15 (App Router, TypeScript) · Tailwind CSS v4 · PostgreSQL 16 + Prisma 6 · Auth.js v5 · next-intl (pt-PT por omissão, en) · MinIO (S3) · Mailpit (email de desenvolvimento) · Redis (opcional) · Vitest · Playwright · Docker Compose · GitHub Actions.

## Arranque rápido (Docker Compose — ambiente completo)

```bash
cp .env.example .env            # defina AUTH_SECRET (openssl rand -base64 32) e SEED_SUPERADMIN_PASSWORD
docker compose up -d --build    # postgres, minio, mailpit e app
```

| Serviço                   | URL                                                      |
| ------------------------- | -------------------------------------------------------- |
| Aplicação                 | http://localhost:3000                                    |
| Mailpit (emails enviados) | http://localhost:8025                                    |
| Consola MinIO             | http://localhost:9001 (`agffminio` / `agffminio-secret`) |
| Health check              | http://localhost:3000/api/health                         |

O contentor `app` aplica as migrações (`prisma migrate deploy`) e o seed (permissões, perfis, organização da plataforma e Super Administrator) ao arrancar. O Super Administrator inicial usa `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` do `.env`; não há password por omissão (sem ela o seed não cria o Super Administrator; sem `AUTH_SECRET` a autenticação não funciona).

Redis é opcional: `docker compose --profile redis up -d`.

## Desenvolvimento local (app fora do Docker)

Requisitos: Node.js ≥ 20.18 e Docker.

```bash
cp .env.example .env
docker compose up -d postgres minio mailpit
npm install
npm run db:migrate      # aplica migrações
npm run db:seed         # RBAC + plataforma + Super Administrator
npm run dev             # http://localhost:3000
```

## Scripts

| Script                                                       | Descrição                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| `npm run dev` / `build` / `start`                            | Next.js                                                         |
| `npm run lint` / `typecheck` / `format:check`                | Qualidade                                                       |
| `npm test`                                                   | Testes unitários (Vitest)                                       |
| `npm run test:integration`                                   | Testes de integração contra `TEST_DATABASE_URL` (Postgres real) |
| `npm run test:e2e`                                           | Playwright (requer `npm run build`, BD com seed e Mailpit)      |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma                                                          |

Husky + lint-staged correm ESLint e Prettier em cada commit.

## Fluxo da Fase 1

1. Uma empresa regista-se em `/register` → fica `PENDING_APPROVAL`; a equipa da plataforma é notificada.
2. Um Super Administrator / Platform Operations aprova (ou rejeita) em `/admin` → a empresa fica `ACTIVE` e o administrador recebe email.
3. O Company Administrator convida utilizadores em `/app/team`, escolhendo o perfil (sem poder atribuir perfis com mais permissões do que as suas).
4. O convidado aceita em `/invite/<token>`, cria conta e entra.

Todas as mutações relevantes ficam no audit log (`/app/audit`, `/admin/audit`).

## Documentação

- [ARCHITECTURE.md](ARCHITECTURE.md) — módulos, camadas, tenancy, RBAC, sessões
- [docs/data-model.md](docs/data-model.md) — modelo de dados (ERD)
- [docs/security.md](docs/security.md) — políticas de segurança e MFA (pendente)
- [docs/integrations.md](docs/integrations.md) — integrações externas pendentes
- [roadmap.md](roadmap.md) — as 5 fases e o que está fora de âmbito
