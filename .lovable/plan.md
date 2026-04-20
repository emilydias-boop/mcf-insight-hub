

## Funil completo segmentado por canal (A010 vs ANAMNESE)

### O que você quer

Visualizar o funil end-to-end **separado por canal de aquisição**, comparando lado a lado:
- **A010** (compradores da consultoria que viram lead Inside Sales)
- **ANAMNESE** (lead vindo do questionário/webhook ANAMNESE / ANAMNESE-INSTA)
- (futuro: LIVE, BIO-INSTAGRAM, etc.)

Cada canal terá seu próprio funil: Universo → Qualificados → Sem Interesse → Agendados R1 → R1 Realizada → No-Show → Contrato Pago → R2 Realizada → Vendas Finais.

### Como cada número será obtido por canal

Reaproveita o classificador único `classifyChannel` (em `src/lib/channelClassifier.ts`) que já é a fonte da verdade do projeto. Ele lê **tags + origem + lead_channel + data_source** do `crm_deals` e devolve o canal normalizado.

| Etapa | Fonte | Como filtrar por canal |
|---|---|---|
| Universo | `crm_deals` (BU + período) | `classifyChannel(deal) === canal` |
| Qualificados / Sem Interesse | `crm_deals` em estágios match | mesmo filtro de canal aplicado ao deal |
| Agendados R1 / R1 Realizada / No-Show | `meeting_slot_attendees` (tipo r1) | join com `crm_deals.id` → classifica → filtra |
| Contrato Pago | attendees com `contract_paid_at` ou stage match | mesmo join + classificação |
| R2 Realizada | `meeting_slot_attendees` (tipo r2) | join + classificação |
| **Vendas Finais (sugestão)** | `webhook_endpoints` + ingestões/`hubla_transactions` | A010: `product_category` ilike `%a010%` `sale_status=completed`; ANAMNESE: vendas Hubla cujo `customer_email/phone` casa com leads cuja classificação foi ANAMNESE no período (preferindo o que veio por webhook do canal) |

> Observação sobre "vendas finais por canal": atribuímos a venda Hubla ao canal **do lead que originou o deal** (não ao produto vendido). Isso responde "quantos leads de A010/ANAMNESE viraram venda final".

### Mudanças

**1. `src/lib/channelClassifier.ts`** — sem mudança (já é fonte única).

**2. `src/hooks/useBUFunnelComplete.ts`** (refactor, ~+80 linhas)
- Buscar os deals do escopo (`crm_deals` filtrado por BU/período/tags) e classificar cada um via `classifyChannel`. Hoje o hook usa `useStageMovements` que retorna apenas o resumo agregado — vamos passar a buscar `crm_deals` raw para conseguir agrupar por canal.
- Trocar retorno: `data: BUFunnelData | null` → `data: { byChannel: Record<ChannelKey, BUFunnelData>, total: BUFunnelData } | null`.
- Para R1/R2: quando carregar `meeting_slot_attendees`, fazer join com os deals já classificados (via `deal_id`) e contar por canal.
- Para vendas Hubla: cruzar `customer_email`/`customer_phone` com os deals do universo para atribuir cada venda ao canal correto.

**3. `src/components/crm/BUFunnelComplete.tsx`** (~+60 linhas)
- Adicionar **seletor de canal** no header: tabs `Todos | A010 | ANAMNESE | ANAMNESE-INSTA | LIVE | …` (só mostra canais com `universo > 0`).
- Quando "Todos" → exibe o funil agregado (comportamento atual).
- Quando um canal específico → exibe o funil daquele canal + um chip "X% do universo total" no topo.
- Modo opcional **comparativo lado a lado** (toggle "Comparar canais"): renderiza colunas paralelas A010 vs ANAMNESE com mesmo eixo, facilitando ver onde cada canal perde mais leads.

**4. Nada novo de banco / nenhuma migration.** Tudo usa tabelas e classificação que já existem.

### UI proposta (modo comparativo)

```
┌─ Funil completo da BU ─── [Todos | A010 | ANAMNESE | ...] [⇄ Comparar] ─┐
│                                                                          │
│                A010              ANAMNESE          Total                 │
│ Universo       312 (47%)         289 (43%)         669                   │
│ Qualificados   95  (30%)         68  (24%)         168                   │
│ Sem Interesse  72  (23%)         110 (38%) ⚠       192                   │
│ Agendados R1   88  (28%)         70  (24%)         163                   │
│ R1 Realizada   62  (70%↑)        45  (64%)         112                   │
│ No-Show R1     26  (30%)         25  (36%) ⚠        51                   │
│ Contrato Pago  21  (24%)          7  (10%)          29                   │
│ R2 Realizada   16                  4                21                   │
│ Vendas Finais   6                  2                 8                   │
└──────────────────────────────────────────────────────────────────────────┘
```

Cores semânticas (verde > média do BU, vermelho < média) destacam onde cada canal performa melhor/pior.

### Sugestão extra (alinhada à sua mensagem)

Você mencionou "puxaria oque vem de webhook de cada um". Para evitar dependência só de tags/origem (que às vezes vêm tortas), adicionar um indicador de **qualidade da classificação** no card: quantos leads do canal foram identificados via webhook (alta confiança) vs via fallback de tag/origem. Aparece como pequeno badge cinza "98% via webhook" ao lado do nome do canal — sem interferir no número, só na confiança.

### Escopo

- 2 arquivos modificados (hook + componente)
- ~140 linhas líquidas
- 0 migration, 0 nova tabela, 0 nova query pesada (mesmas tabelas, só agrupamento extra)

### Antes de implementar — confirmar

1. **Vendas Finais por canal**: atribuir ao canal do **lead que originou o deal** (recomendado, responde "ROI do canal") ou ao **produto vendido** (A010 = consultoria, parceria = ANAMNESE)?
2. **Modo padrão**: abrir já em "Comparar A010 vs ANAMNESE" lado a lado, ou abrir em "Todos" (agregado) com seletor para trocar?
3. **Quais canais incluir no seletor inicial**: só A010 e ANAMNESE (foco da sua mensagem) ou todos os 6 canais já mapeados (`A010, LIVE, ANAMNESE, ANAMNESE-INSTA, OUTSIDE, LANÇAMENTO`)?

