# Módulo SHP — Expedições (Fase 2A)

- Serviço: `services/shipment.service.ts` — criar/editar expedições, paragens (ordenáveis) e carga; transições de estado.
- Máquina de estados (`shipment-status.ts`), validada no servidor:
  `DRAFT → REQUESTED → (QUOTED) → BOOKED → IN_TRANSIT ⇄ AT_CUSTOMS → DELIVERED`; `CANCELLED` a partir de qualquer estado anterior a `IN_TRANSIT`.
- Pré-requisitos: `request` exige recolha, entrega e carga; `book` exige transportador **verificado** (`TRANSPORTER`/`FREIGHT_FORWARDER`).
- Rota e carga só são editáveis até `QUOTED`.
- Referência sequencial por empresa e ano (`SHP-2026-000001`), gerada sob advisory lock.
- Parceiros e centros de custo referenciados são validados no tenant actual. Todas as mutações ficam no audit log com antes/depois.
- Pendente (2C): o estado `QUOTED` e a reserva passam a ser accionados pelo leilão do marketplace.
