

## Fix: Acumulado por estágio = histórico completo de cada lead envolvido

### Definição final

Para cada estágio X, o **Acumulado** = nº de leads únicos cujo **histórico completo em `deal_activities`** mostra que ele já passou por X em algum momento (sem filtro de data), considerando apenas leads que:
- Tiveram movimentação no período selecionado, OU
- Estão atualmente em algum estágio (snapshot)

**Resultado:** se um lead está hoje em "Reunião 01 Agendada", o sistema busca todo o histórico dele e soma +1 em "Lead Qualificado", "Novo Lead", etc. — mesmo que essas movimentações tenham sido há meses.

Isso faz o funil ficar coerente: estágios anteriores >= posteriores naturalmente.

### Mudanças no código

**Arquivo único:** `src/hooks/useStageMovements.ts`

**1. Coletar o universo de deals do período**

Mantém:
- `acts` = stage_changes no período
- `snapshotDeals` = deals com stage_id atual (filtrados por origem)
- `filteredDealsMap` = união filtrada por tags

**2. Buscar histórico completo desses deals (NOVA query)**

Após `filteredDealsMap` estar pronto, fazer:
```ts
const allDealIds = Array.from(filteredDealsMap.keys());
const historyChunks = chunk(allDealIds, 200);
const historyResults = await Promise.all(historyChunks.map(async (ids) => {
  const { data } = await supabase
    .from('deal_activities')
    .select('deal_id, to_stage, from_stage, created_at')
    .eq('activity_type', 'stage_change')
    .in('deal_id', ids);
  return data || [];
}));
const fullHistory = historyResults.flat();
```

Sem filtro de data — pega o histórico completo de cada deal envolvido.

**3. Construir `stagesPassedByDeal: Map<dealId, Set<stageNameKey>>`**

Para cada activity em `fullHistory`:
- Resolve `to_stage` → nome → `stageNameKey`
- Adiciona ao Set do deal

Adicionalmente, para cada deal com `stage_id` atual:
- Resolve → `stageNameKey`
- Adiciona ao Set (cobre o estágio atual, mesmo que nunca tenha sido registrado um stage_change pra ele)

**4. Calcular `uniqueLeads` (Acumulado) com base no histórico completo**

Substituir o cálculo atual por:
```ts
stagesPassedByDeal.forEach((stagesSet, dealId) => {
  stagesSet.forEach((stageKey) => {
    const stage = resolveStageByKey(stageKey); // precisa map name→stage
    const e = ensureEntry(stageKey, stage);
    e.uniqueLeads.add(dealId);
  });
});
```

**5. Manter `passagens` e `parados` como hoje**

Para preservar as colunas atuais:
- **Passagens** = só conta `acts` do período (movimentações registradas no intervalo)
- **Parados** = só conta deals com `stage_id` atual = X
- **Acumulado** = `uniqueLeads.size` (calculado pelo histórico completo)

Resultado esperado nas 3 colunas (exemplo do print):
- Lead Qualificado: Acumulado **~250+** (todos que estão em Qualificado, R1, R2, Contrato), Passaram 8, Estão lá 4
- R1 Agendada: Acumulado 116 (mesmo de antes, ou maior se houver leads em estágios posteriores que passaram por R1), Passaram 134, Estão lá 15
- Contrato Pago: Acumulado 8 (não muda, é o último), Passaram 4, Estão lá 5

**6. Linhas de detalhe (rows)**

Manter como está:
- Linhas de movimentação real (do período) → `when = data`, `isSnapshotOnly = false`
- Linhas snapshot (parado, sem movimentação no período) → `when = null`, `isSnapshotOnly = true`

Não vou criar linhas "histórica" para cada estágio passado fora do período (seria poluir muito a tabela). O detalhe continua mostrando movimentações do período + paradas atuais. O **Acumulado** na coluna mostra o número correto via histórico, mas o detalhe lista só o que aconteceu/está acontecendo no período.

**Tooltip atualizado** na coluna Acumulado: "Leads únicos que já passaram por este estágio em algum momento de seu histórico (entre os leads ativos no período)".

### Garantias

- **Funil monotonicamente decrescente** (ou igual) nos estágios principais — naturalmente, sem hardcode de trilha
- **Estágios laterais** (No-Show, Sem Interesse, Anamnese Incompleta, Lead Gratuito) só recebem +1 se o lead realmente passou por eles no histórico
- **Sem inferência artificial**: respeita 100% o que `deal_activities` registrou
- **Sem dupla contagem**: Set por `dealId` + `stageNameKey`
- **Performance**: 1 query extra paginada (200/chunk) sobre `deal_activities`. Como `filteredDealsMap` raramente passa de alguns milhares, fica rápido (~100-500ms extra)

### Limites conhecidos

- Se um lead nunca teve `stage_change` registrado pra um estágio (ex: foi criado direto em Lead Qualificado e foi pra R1 sem registro intermediário), esse estágio não conta no histórico dele. Decisão consciente: respeita o registro.
- Histórico depende do limite default do Supabase de 1000 rows por chunk (paginado, OK até ~200k activities totais).
- Para o snapshot atual, o `stage_id` do `crm_deals` é sempre adicionado ao histórico do deal — então mesmo deals criados direto num estágio aparecem nele.

### Validação

1. `/crm/movimentacoes`, Inside Sales, últimos 7 dias:
   - Lead Qualificado mostra Acumulado >= R1 Agendada >= R1 Realizada >= Contrato Pago
   - Coluna "Passaram" e "Estão lá" continuam mostrando os números atuais (não mudam)
   - Só "Acumulado" recebe boost
2. Estágios laterais (Sem Interesse, No-Show) NÃO inflam — só contam se o lead realmente passou
3. Performance: página carrega em até ~3s mesmo com 5k+ deals

### Escopo

- 1 hook editado: `src/hooks/useStageMovements.ts` (+1 query de histórico completo, +lógica de agregação por histórico)
- 1 componente: `StageMovementsSummaryTable.tsx` — só atualizar o texto do tooltip
- Zero migration, zero RLS, zero outras telas afetadas

