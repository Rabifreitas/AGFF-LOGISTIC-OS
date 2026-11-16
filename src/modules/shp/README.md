# Módulo SHP — Expedições (Fase 2A)

- Serviço: `services/shipment.service.ts` — criar/editar expedições, paragens (ordenáveis) e carga; transições de estado.
- Máquina de estados (`shipment-status.ts`), validada no servidor:
  `DRAFT → REQUESTED → (QUOTED) → BOOKED → IN_TRANSIT ⇄ AT_CUSTOMS → DELIVERED`; `CANCELLED` a partir de qualquer estado anterior a `IN_TRANSIT`.
- Pré-requisitos: `request` exige recolha, entrega e carga; `book` exige transportador **verificado** de um tipo transportador (`CARRIER_TYPES`: rodoviário, transitário, armador, companhia aérea, ferroviário, fluvial, correio expresso, cargas pesadas) que **opere o modo** da expedição.
- Modos: rodoviário, ferroviário, marítimo, cabotagem, fluvial/lacustre, aéreo, pipeline e multimodal.
- Pernas (`ShipmentLeg`): cada troço tem modo, transportador, equipamento e referências (matrícula, navio/viagem, voo, B/L/AWB/CMR). `MULTIMODAL` exige ≥ 2 modos diferentes; na reserva, cada transportador de perna tem de estar verificado e operar o modo da perna.
- Serviços pedidos (`services[]`) e tipos de carga (contentor, granéis, Ro-Ro, refrigerada com temperatura, perigosa com ONU/IMO, …).
- Rota e carga só são editáveis até `QUOTED`.
- Referência sequencial por empresa e ano (`SHP-2026-000001`), gerada sob advisory lock.
- Parceiros e centros de custo referenciados são validados no tenant actual. Todas as mutações ficam no audit log com antes/depois.
- Pendente (2C): o estado `QUOTED` e a reserva passam a ser accionados pelo leilão do marketplace.
