

## Fix: Universo correto + funil completo (incluindo No-Show/Sem Interesse)

### Diagnóstico da diferença

Você disse: **669 leads com tag anamnese → 168 qualificados → 192 sem interesse → 163 agendados → 112 R1 realizada → 51 no-show → 29 contrato → 21 R2 realizada → 8 vendas**.

O dashboard hoje diverge por 4 razões:

1. **Universo subestimado**: o "acumulado" só considera deals que (a) tiveram movimentação no período OU (b) estão no snapshot atual. Deals com a tag que ficaram parados em estágios laterais (Sem Interesse, Perdido) há meses **não entram no universo**, então o total é menor que 669.

2. **Snapshot truncado em 10.000**: `PIPELINE INSIDE SALES` sozinha tem >14k deals. O `.limit(10000)` no `crm_deals` corta o snapshot, perdendo leads. Quando você combina 2 pipelines, a perda é ainda maior.

3. **No-Show e Sem Interesse fora da MAIN_TRAIL**: o seu funil real inclui essas etapas como passagens válidas. Hoje elas só contam se houver `stage_change` explícito registrado. Como muitos leads vão direto para "Sem Interesse" sem passar por estágios anteriores documentados, o acumulado deles fica subestimado.

4. **Variações de nome entre pipelines**: "INCOMPLETA" (Piloto), "ANAMNESE INCOMPLETA" (Inside Sales), "REUNIÃO 1 AGENDADA" vs "Reunião 01 Agendada", "NO-SHOW" vs "No-Show". A normalização atual junta alguns mas não todos.

### Solução

#### 1. Universo = TODOS os deals que batem com origens + tags (sem depender de movimentação)

Em `useStageMovements.ts`, mudar a definição do universo:

```ts
// Universo = todos os deals das origens selecionadas que passam no filtro de tags
// (independente de ter movimentação no período ou estar no snapshot recente)
const { data: universeDeals } = await supabase
  .from('crm_deals')
  .select('id, name, tags, origin_id, stage_id')
  .in('origin_id', queryOriginIds)
  .order('created_at', { ascending: false })
  .range(...) // paginar para passar de 10k
```

Paginar por chunks de 1000 com `.range()` até esgotar (similar ao padrão usado em `useDealActivitySummary`). Aplicar o filtro de tags em memória sobre esse universo completo.

Esse passa a ser o `filteredDealsMap` definitivo. O período de data passa a ser usado **apenas** para a coluna "Passaram" (movimentações no intervalo), não para definir quais leads contam no acumulado.

#### 2. Expandir MAIN_TRAIL para incluir variações de nome e estágios laterais sequenciais

Mapa de aliases por nome normalizado, agrupando pipelines diferentes:

```ts
const STAGE_ALIASES: Record<string, string> = {
  'incompleta': 'anamnese incompleta',
  'anamnese incompleta': 'anamnese incompleta',
  'novo lead': 'novo lead',
  'novo lead ( form )': 'novo lead',
  'lead qualificado': 'lead qualificado',
  'reuniao 01 agendada': 'r1 agendada',
  'reuniao 1 agendada': 'r1 agendada',
  'r1 agendada': 'r1 agendada',
  'reuniao 01 realizada': 'r1 realizada',
  'reuniao 1 realizada': 'r1 realizada',
  'r1 realizada': 'r1 realizada',
  'no-show': 'no-show',
  'no show': 'no-show',
  'sem interesse': 'sem interesse',
  'reuniao 02 agendada': 'r2 agendada',
  'r2 agendada': 'r2 agendada',
  'reuniao 02 realizada': 'r2 realizada',
  'r2 realizada': 'r2 realizada',
  'contrato pago': 'contrato pago',
  'venda realizada': 'venda realizada',
  'proposta enviada': 'proposta enviada',
  'no-show r2': 'no-show r2',
};
```

A função `normalizeStageName` passa a aplicar o alias depois de normalizar acentos/espaços, fazendo "INCOMPLETA" e "ANAMNESE INCOMPLETA" virarem a mesma chave.

#### 3. Inferência: trilha principal + ramais laterais

Trilha principal (cada lead que atingiu N infere passagem por todos anteriores):
```
anamnese incompleta → novo lead → lead qualificado → r1 agendada → r1 realizada → r2 agendada → r2 realizada → contrato pago → venda realizada
```

**Estágios laterais com inferência de "pré-requisito"** (não estão na linha principal, mas implicam que o lead chegou até certo ponto):
- `no-show` → infere passagem até `r1 agendada` (pra ter levado no-show, foi agendado)
- `no-show r2` → infere passagem até `r2 agendada`
- `sem interesse` / `proposta enviada` → não inferem nada (podem ocorrer em qualquer ponto)

Implementação:
```ts
const LATERAL_PREREQ: Record<string, string> = {
  'no-show': 'r1 agendada',
  'no-show r2': 'r2 agendada',
};

stagesPassedByDeal.forEach((stagesSet) => {
  // 1) Inferência de trilha principal (já existe)
  let maxTrailIndex = -1;
  stagesSet.forEach((k) => {
    const idx = MAIN_TRAIL.indexOf(k);
    if (idx > maxTrailIndex) maxTrailIndex = idx;
  });
  if (maxTrailIndex >= 0) {
    for (let i = 0; i <= maxTrailIndex; i++) stagesSet.add(MAIN_TRAIL[i]);
  }
  // 2) Inferência de pré-requisito de estágios laterais
  stagesSet.forEach((k) => {
    const prereq = LATERAL_PREREQ[k];
    if (prereq) {
      const idx = MAIN_TRAIL.indexOf(prereq);
      for (let i = 0; i <= idx; i++) stagesSet.add(MAIN_TRAIL[i]);
    }
  });
});
```

#### 4. Histórico completo precisa cobrir o universo expandido

Hoje o histórico já busca para todos os `filteredDealsMap`. Como esse Map agora tem o universo correto (com paginação), o histórico vai cobrir tudo automaticamente. Manter o chunking de 200 IDs.

#### 5. Multi-pipeline na UI

A página atual só permite escolher **uma** pipeline ou "todas". Para reproduzir seu cenário (Inside Sales + Piloto Anamnese), trocar o `Select` único por:
- Manter "Todas as pipelines" como opção rápida
- Adicionar opção "Selecionar múltiplas..." que abre um popover com checkboxes (padrão similar ao `TagFilterPopover` já existente)

Estado vira `originIds: string[]` em vez de `originId: string`. A query já aceita array.

### Resultado esperado (cenário do print + Piloto Anamnese)

| Estágio | Acumulado |
|---|---|
| Anamnese Incompleta | ~669 (universo total com tag) |
| Novo Lead | ~669 (todos passaram) |
| Lead Qualificado | ~250 (168 do print + 82 do Piloto) |
| R1 Agendada | ~163 |
| R1 Realizada | ~112 |
| No-Show | ~51 (lateral, sem inferência pra cima) |
| Sem Interesse | ~192 (sem inferência) |
| Contrato Pago | ~29 |
| R2 Realizada | ~21 |
| Venda Realizada | ~8 |

### Escopo

- `src/hooks/useStageMovements.ts` — universo paginado (sem limite de 10k), aliases de estágio, MAIN_TRAIL expandida, inferência de prereq lateral (~50 linhas alteradas)
- `src/pages/crm/MovimentacoesEstagio.tsx` — multi-select de pipelines (~30 linhas)
- `src/components/crm/StageMovementsSummaryTable.tsx` — tooltip atualizado mencionando inferência

Zero migration, zero RLS, zero edge function.

### Validação

1. Selecionar **PIPELINE INSIDE SALES + PILOTO ANAMNESE** + tag anamnese, período últimos 90 dias:
   - Anamnese Incompleta ≈ 669
   - Funil monotonicamente decrescente nos estágios principais
   - No-Show ≈ 51 (não infla acima de R1 Agendada)
2. Console: `dealsAfterFilter` próximo de 669 (não truncado)
3. Tooltip explica que estágios laterais (No-Show) inferem passagem por agendamento anterior, mas não pelos seguintes

