# Módulo DMS

Gestão documental (Fase 2B): documentos da empresa ou ligados a uma expedição, com versões, SHA-256 e aprovação.

- **Upload** (`uploadVersion`): PDF, PNG, JPG, WEBP, DOCX, XLSX até 15 MB. O tipo é validado pela extensão **e** pelos bytes iniciais (o `Content-Type` do cliente é ignorado). Cada versão é gravada no MinIO sob `org/<organizationId>/documents/<documentId>/<uuid>`; se a transacção falhar o objecto é removido.
- **Download**: `GET /api/documents/:id/versions/:n` — passa sempre pela app (sessão, organização activa, `dms.documents.read`, `tenantDb`), responde como `attachment` com `nosniff` e regista `document.downloaded` na auditoria. Não há URLs públicos/presigned: o endpoint do MinIO não precisa de ser acessível ao browser.
- **Estados** (`document-status.ts`): `DRAFT → PENDING_REVIEW → APPROVED | REJECTED`, e `DRAFT/APPROVED/REJECTED → ARCHIVED`. Submeter exige ≥1 versão; aprovar/rejeitar exige `dms.documents.approve` (Document Controller, Company Admin); rejeitar exige motivo. Em revisão ou arquivado o conteúdo fica congelado; uma nova versão ou alteração de metadados num documento aprovado/rejeitado volta a `DRAFT`.
- **Validade**: filtro "a expirar (30 dias)" e contador no painel (inclui expirados, exclui arquivados).

Pendente: OCR, notificações agendadas de validade, assinatura electrónica, antivírus no upload — ver [docs/integrations.md](../../../docs/integrations.md).
