# Módulo MKT — Parceiros e marketplace

## 2A (implementado)

- `services/partner.service.ts`: parceiros por empresa (transportadores, transitários, despachantes, clientes, …) e verificações.
- Estados: `DRAFT → PENDING_VERIFICATION → VERIFIED | REJECTED`, `VERIFIED ⇄ SUSPENDED`. Só se marca como verificado com pelo menos uma verificação aprovada (e não expirada).
- Upload dos documentos de verificação chega com o DMS (2B).
- Tipos para toda a cadeia: transportador rodoviário, transitário, despachante, armazém, armador, agente de navegação, companhia aérea, operador ferroviário e fluvial, terminal portuário, estiva, parque de contentores, correio expresso, gruas/cargas pesadas, seguradora e inspecção.
- Cada parceiro declara os modos que opera e os serviços que presta (`modes[]`, `services[]`); a reserva valida o modo.

## 2C (implementado) — leilão cego com tempo limite

- `services/auction.service.ts`, regras puras em `auction-rules.ts`.
- **Perfil de prestador** (`ProviderProfile`, um por empresa): modos, serviços e países. `DRAFT → PENDING → VERIFIED | REJECTED`, `VERIFIED ⇄ SUSPENDED`, verificado pela AGFF em `/admin/providers` (`platform.providers.verify`). Alterar modos/serviços de um perfil verificado volta a `PENDING`.
- **Leilão** (`Auction`): publicado a partir de uma expedição `REQUESTED`, com fecho entre 15 min e 30 dias, modos aceites e serviços exigidos. Guarda um snapshot anónimo (cidades/países, datas, resumo da carga, peso/volume, perigosa); moradas, contactos, nome do expedidor e notas internas nunca saem do tenant.
- **Elegibilidade**: perfil `VERIFIED` e dentro da validade, pelo menos um modo em comum, todos os serviços exigidos, e nunca a própria empresa.
- **Propostas seladas** (`AuctionBid`, uma por empresa e leilão): alteráveis e retiráveis até ao fecho. O expedidor só vê a contagem até fechar; os concorrentes nunca se vêem. A auditoria das propostas fica só na empresa licitante.
- **Fecho**: `sweepDueAuctions()` (idempotente) corre em cada leitura e em `POST /api/cron/auctions` (`Authorization: Bearer $CRON_SECRET`). Com propostas → `CLOSED`; sem propostas → `EXPIRED`.
- **Adjudicação** (só depois do fecho, livre escolha): o prestador passa a parceiro `VERIFIED` do expedidor (verificação `MARKETPLACE`), regista-se a cotação `ACCEPTED`, a expedição passa a `QUOTED → BOOKED` com as validações de modo/verificação de sempre, a vencedora fica `ACCEPTED` e as restantes `LOST`. Só a vencedora passa a ver o contacto do expedidor.
- Pendente: a vencedora registar tracking directamente na expedição do expedidor; prolongamento automático em licitações de última hora.
