# Módulo TRK — Tracking e incidentes (Fase 2A)

- `services/tracking.service.ts`: eventos manuais imutáveis (`PICKED_UP`, `DEPARTED`, `ARRIVED`, `CUSTOMS_IN`, `CUSTOMS_CLEARED`, `DELAYED`, `DELIVERED`, `NOTE`).
  Só em expedições `BOOKED`/`IN_TRANSIT`/`AT_CUSTOMS`. Os eventos com efeito de estado aplicam a transição pela máquina de estados de `shp` (eventos incoerentes são rejeitados).
- `services/incident.service.ts`: incidentes `OPEN → INVESTIGATING → RESOLVED → CLOSED`, com reabertura a partir de `RESOLVED`; resolver exige descrição da resolução.
- Permissões: `trk.events.read/create` (o Motorista regista eventos), `incidents.read/manage`.
- Pendente: GPS/telemática e eventos automáticos (Fase 4); hoje o Motorista vê todas as expedições da empresa — a atribuição por motorista chega com a frota (TMS).
