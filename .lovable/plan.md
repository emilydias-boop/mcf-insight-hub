

## Fix: Período passa a controlar TODAS as colunas (sem misturar fixo + dinâmico)

### Entendimento

Você não quer um híbrido (universo fixo + colunas dinâmicas). Quer que **o período escolhido seja a única fonte de verdade**: tudo (Acumulado, Passaram, Estão lá, Detalhe) reflete o intervalo selecionado.

### Comportamento atual (errado)

- **Acumulado**: universo fixo = todos os deals da origem + tag, ignora o período
- **Passaram**: dinâmico, filtra por `deal_activities.created_at` no período
- **Estão lá**: snapshot atual, ignora o período
- **Detalhe**: dinâmico, filtra por período

Resultado: trocar o período só muda 1 das 3 colunas visíveis e parece que "nada muda".

### Comportamento desejado (tudo dinâmico pelo período)

Um lead conta no estágio X **se e somente se** ele passou por X durante o período selecionado. Definição uniforme:

| Coluna | Definição |
|---|---|
| **Acumulado** | Leads únicos que passaram por X em algum momento **dentro do período** (via `deal_activities` + inferência de trilha) |
| **Passaram** | = Acumulado (mesma definição). Manter as duas colunas só faz sentido se forem definições diferentes — vamos consolidar |
| **Estão lá** | Leads que estão no estágio X **no fim do período** (snapshot na `endDate`, não "agora") |
| **Detalhe** | Movimentações com `created_at` no período |

### Mudanças no código

**Arquivo único:** `src/hooks/useStageMovements.ts`

**1. Remover a query paginada de "universo total"**

Apagar o bloco que busca todos os deals das origens (paginado, ignorando data). O universo passa a ser construído **somente** a partir de `deal_activities` filtrada por `created_at` no período + inferência.

**2. Reconstruir `stagesPassedByDeal` apenas com movimentações no período**

```ts
// Para cada activity de stage_change no período:
//   stagesPassedByDeal.get(dealId).add(toStageKey)
//   stagesPassedByDeal.get(dealId).add(fromStageKey)  // origem da movimentação também conta como "passou"
```

Aplicar inferência de MAIN_TRAIL e LATERAL_PREREQ por cima desse Set (igual hoje).

**3. "Estão lá" = snapshot no fim do período, não "agora"**

Para cada deal envolvido, descobrir o estágio que ele estava em `endDate`:
- Pegar a última `stage_change` do deal com `created_at <= endDate`
- Se não houver nenhuma, usar o `stage_id` atual de `crm_deals` apenas se o deal foi criado antes de `endDate`

```ts
// Pseudo:
const stageAtEndOfPeriod = lastStageChangeBefore(dealId, endDate)?.toStage
  ?? (deal.created_at <= endDate ? deal.stage_id : null);
```

Contar `stageAtEndOfPeriod` por estágio para a coluna "Estão lá".

**4. Consolidar Acumulado e Passaram OU diferenciar claramente**

Opções:
- **A)** Manter ambas com a mesma definição e renomear "Passaram" para algo como "Movimentações" (count de eventos, não de leads únicos). Hoje "Passaram" já é count de eventos, então só precisa garantir o tooltip.
- **B)** Remover a coluna duplicada.

Recomendação: **opção A** — Acumulado = leads únicos no período, Passaram = nº de movimentações (eventos) no período. Já é assim hoje, só precisa atualizar o tooltip do Acumulado.

**5. Atualizar tooltips em `StageMovementsSummaryTable.tsx`**

- **Acumulado**: "Leads únicos que passaram por este estágio dentro do período selecionado (inclui inferência da trilha do funil)."
- **Passaram**: "Número de movimentações (eventos) que entraram neste estágio no período."
- **Estão lá**: "Leads que estavam neste estágio no fim do período selecionado."

### Resultado esperado

- Trocar 30d → 7d: **todos** os números diminuem proporcionalmente
- Trocar 30d → 90d: **todos** os números aumentam
- Não há mais "universo fixo" — período é a única dimensão temporal

### Garantias

- Funil continua monotônico decrescente nos estágios principais (inferência de trilha preservada)
- Estágios laterais (No-Show, Sem Interesse) continuam sem inflar
- Multi-pipeline continua funcionando
- Filtro de tags continua aplicando sobre o universo derivado de `deal_activities`

### Trade-off

Leads que entraram numa origem dentro do período mas **nunca tiveram movimentação registrada** (caso raro: criados direto sem nenhum stage_change) não vão aparecer. Para cobrir esse caso, podemos **opcionalmente** adicionar deals criados no período via `crm_deals.created_at BETWEEN start AND end` ao universo, mapeando o estágio atual deles como "passagem" no período. Isso mantém tudo dinâmico pelo período e cobre leads novos sem histórico.

### Escopo

- `src/hooks/useStageMovements.ts` (~40 linhas: remove query paginada, ajusta lógica de snapshot)
- `src/components/crm/StageMovementsSummaryTable.tsx` (~3 tooltips)
- Zero migration, zero mudança em UI principal

