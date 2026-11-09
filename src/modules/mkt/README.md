# Módulo MKT — Parceiros e marketplace

## 2A (implementado)

- `services/partner.service.ts`: parceiros por empresa (transportadores, transitários, despachantes, clientes, …) e verificações.
- Estados: `DRAFT → PENDING_VERIFICATION → VERIFIED | REJECTED`, `VERIFIED ⇄ SUSPENDED`. Só se marca como verificado com pelo menos uma verificação aprovada (e não expirada).
- Upload dos documentos de verificação chega com o DMS (2B).

## 2C (pendente) — leilão com prazo

- O expedidor publica um pedido com data/hora de fecho; transportadoras verificadas vêem uma versão anonimizada e licitam às cegas.
- No fecho, o expedidor adjudica (não necessariamente a mais barata); a expedição passa a `BOOKED` e a vencedora ganha acesso à expedição.
- Pedidos sem propostas expiram automaticamente.
