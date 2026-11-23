# Demonstração para investidores

Guião de ~10 minutos com dados fictícios. Todas as empresas, pessoas, matrículas e números são inventados.

## Preparar

```bash
docker compose up -d postgres minio mailpit
npx prisma migrate deploy && npx prisma db seed
DEMO_PASSWORD='<escolha uma password>' npm run seed:demo
npm run build && npm run start
```

`seed:demo` pode ser corrido antes de cada apresentação: volta a pôr os 6 motoristas online perto de Luanda e cancela corridas de demo inacabadas. Recusa correr em produção (salvo `DEMO_ALLOW_PRODUCTION=1`). Todas as contas usam a password de `DEMO_PASSWORD`.

| Papel                                     | Conta                               |
| ----------------------------------------- | ----------------------------------- |
| Plataforma AGFF                           | `plataforma@demo.agff.ao`           |
| Expedidor (Kwanza Trading)                | `admin@kwanza.demo.agff.ao`         |
| Prestador 1 — Trans Atlântico             | `admin@transatlantico.demo.agff.ao` |
| Prestador 2 — Rota do Sul                 | `admin@rotadosul.demo.agff.ao`      |
| Motorista mais próximo do Porto de Luanda | `ld-24-61-aa@demo.agff.ao`          |

Use duas janelas: o expedidor no portátil e o motorista numa janela anónima em modo telemóvel (390 px).

## Guião

1. **Landing** (`/`): a proposta — frete imediato, leilão, todos os modos, segurança multiempresa.
2. **Frete imediato — expedidor** (`/app/freight`): Porto de Luanda → Viana, porta-contentores 20'/40', 2 estivadores e seguro ENSA. O preço fixo em AOA actualiza-se em tempo real, com a fórmula visível. "Solicitar Frete Imediato" → radar "A procurar motorista".
3. **Motorista** (`/app/driver`): a oferta aparece com contagem de 30 s, valor líquido, recolha/entrega e carga. Aceitar.
4. **Expedidor**: "Motorista a caminho", nome, matrícula e o código de entrega de 6 dígitos.
5. **Motorista**: "Cheguei à recolha" → "Carga recolhida — iniciar viagem" → introduz o código → entregue. Ganhos e histórico actualizam.
6. **Expedidor**: avalia 5/5 → TrustScore do prestador. A expedição criada automaticamente está em `/app/shipments` com o tracking de cada passo.
7. **Frota** (`/app/fleet` como Trans Atlântico): veículos, motoristas online, posições e trabalhos com o valor do prestador.
8. **Leilão** (`/app/auctions` como expedidor, `/app/marketplace` como Rota do Sul): pedido anonimizado, proposta selada, o expedidor só vê a contagem até ao fecho.
9. **Plataforma** (`/admin`): aprovação de empresas, verificação de prestadores, tabela de tarifas (`/admin/freight-tariffs`) e audit log.

## O que é simulado (dizer na apresentação)

- **Distância**: linha recta × 1,3 (factor rodoviário), marcada "estimada" — falta a API de mapas e rotas.
- **Mapa**: radar esquemático, sem mosaicos de mapa reais.
- **Pagamentos**: o preço é registado; o escrow EMIS/Multicaixa está pendente.
- **AGT e-Frete, ENSA, MINTRANS**: os extras são calculados e registados, sem integração real.
- **Tarifas**: valores de referência editáveis em `/admin/freight-tariffs`, não preços comerciais aprovados.
- **Comissão AGFF / distribuição de lucro**: ainda não implementada.
