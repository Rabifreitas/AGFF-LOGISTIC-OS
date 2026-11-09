# Roadmap — AGFF Logistics OS

| Fase  | Nome                     | Âmbito                                                                                                                                                                                                                                                                                                                                               | Estado                             |
| ----- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **1** | **Foundation**           | Infra (Docker, CI), IAM (registo, login, recuperação de password, sessões, convites, bloqueio, histórico de acessos), RBAC com 11 perfis, multi-tenancy, ORG (empresas, NIF, dados fiscais, endereços, contactos, representantes, departamentos, centros de custo, configurações), audit log, câmbios, notificações, i18n pt-PT/en, painel admin     | **Neste repositório**              |
| 2     | Operações logísticas     | **2A** parceiros e verificação (`mkt`), expedições com paragens, carga e máquina de estados (`shp`), tracking manual e incidentes (`trk`) · **2B** gestão documental com versões, SHA-256 e aprovação (`dms`; OCR pendente) · **2C** marketplace em leilão com prazo: licitação às cegas por transportadoras verificadas, adjudicação pelo expedidor | 2A e 2B implementados; 2C pendente |
| 3     | Procurement e financeiro | Fornecedores e procurement (`sup`), facturação, pagamentos, escrow, reconciliação, câmbios BNA (`fin`), assinatura electrónica                                                                                                                                                                                                                       | Pendente                           |
| 4     | Mobile e integrações     | App móvel (motorista, cliente), MFA, SMS/WhatsApp, telemática/GPS, APIs públicas e webhooks                                                                                                                                                                                                                                                          | Pendente                           |
| 5     | Inteligência e expansão  | IA (previsão de procura, pricing, detecção de anomalias e fraude documental), BI/relatórios avançados, multi-país (moedas, fiscalidade e idiomas de outros mercados africanos)                                                                                                                                                                       | Pendente                           |

## Fora de âmbito da Fase 1 (pendente)

Marketplace, cotações, OCR, alertas automáticos de validade (notificações agendadas), financeiro (além do registo manual de câmbios), mobile, IA e MFA. Ver também [docs/integrations.md](docs/integrations.md) e [docs/security.md](docs/security.md).

## Próximo plano (Fase 2) — pontos de partida

- Serviços e UI sobre as tabelas da Fase 2, sempre via `tenantDb()` e `assertPermission()`.
- Novas permissões no catálogo (`src/modules/iam/permissions.ts`) e no `registry.ts` para activar os módulos.
- Upload para MinIO com `tenantObjectKey()`.
