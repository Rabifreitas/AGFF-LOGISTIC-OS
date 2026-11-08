# Segurança — Fase 1

| Tema                    | Implementação                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Passwords               | bcrypt (custo 12); mínimo 10 caracteres com minúscula, maiúscula e dígito                                                             |
| Bloqueio automático     | 5 tentativas falhadas → bloqueio temporário de 15 min (`src/modules/iam/lockout.ts`)                                                  |
| Bloqueio administrativo | Platform Operations / Super Administrator bloqueiam/desbloqueiam contas em `/admin/users`; todas as sessões são revogadas             |
| Sessões                 | Linha na tabela `sessions`, validada em cada pedido; expiram em 12 h; revogáveis em `/account`; revogadas ao alterar/repor a password |
| Recuperação de password | Token aleatório de uso único (só o hash SHA-256 é guardado), válido 60 min; resposta idêntica exista ou não o email                   |
| Convites                | Token de uso único (hash guardado), válido 7 dias, ligado ao email convidado                                                          |
| Histórico de acessos    | `access_logs`: login com sucesso/falha, bloqueio, logout, reset (IP e user agent)                                                     |
| RBAC                    | Verificado no servidor em cada serviço (`assertPermission`), com anti-escalada na atribuição de perfis                                |
| Multi-tenancy           | `tenantDb(orgId)` força o `organization_id` vindo da sessão                                                                           |
| Auditoria               | `audit_logs` com antes/depois; segredos removidos                                                                                     |
| Cabeçalhos              | `X-Powered-By` desactivado                                                                                                            |

## Pendente

- **MFA (TOTP / SMS)** — o campo `users.mfa_enabled` existe e o estado é mostrado em `/account`, mas a autenticação de dois factores **não está implementada**. Planeado para a Fase 4 (com o fornecedor de SMS/WhatsApp, ver [integrations.md](integrations.md)).
- Rate limiting por IP nos endpoints de autenticação (Redis já disponível como serviço opcional).
- Política de retenção/arquivo dos audit logs e access logs.
- Rotação de segredos e gestão via cofre (produção).
- Perfis personalizados por empresa (o modelo `roles.organization_id` já o suporta).
