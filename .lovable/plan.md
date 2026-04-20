

## Fix: Funil acumulado real por estágio (passagens + snapshot atual)

### Definição final do número exibido por estágio

Para cada estágio no período selecionado, exibir o **acumulado único** de leads que:
- **(A) Passaram pelo estágio** dentro do período (registrado em `deal_activities` como `stage_change` com `to_stage = X`), OU
- **(B) Estão atualmente no estágio** (snapshot: `crm_deals.stage_id = X` hoje), independente de quando entraram

**Sem dupla contagem**: se o mesmo lead aparece em (A) e (B), conta uma vez só (Set por `deal_id`).

**Sem inferência de pulos**: respeita 100% o que está registrado. Se um lead pulou de Novo direto pra Contrato Pago, os intermediários não recebem +1.

**Resultado**: cada estágio mostra o "tamanho real" do volume que tocou aquele estágio na janela de tempo, somado ao que está parado lá hoje.

### Mudanças no código

**Arquivo único:** `src/hooks/useStageMovements.ts`

**1. Adicionar busca de snapshot atual**

Após a query de `deal_activities`, fazer uma segunda query em `crm_deals` filtrando pelas mesmas origens (e pelas mesmas tags), trazendo `id, stage_id, origin_id, tags, name`:
```ts
const { data: currentDeals } = await supabase
  .from('crm_deals')
  .select('id, name, stage_id, origin_id, tags')
  .in('origin_id', queryOriginIds ?? [...])
  .not('stage_id', 'is', null);
```
Aplicar o mesmo filtro de tags em memória.

**2. Construir o agregado unificado**

Substituir o `summaryMap` atual (que só conta passagens) por uma estrutura que combine ambas as fontes:
```ts
// Map<stageNameKey, { stageName, stageOrder, uniqueLeads: Set<dealId>, passagens: number, parados: number }>
```
- Para cada activity de `stage_change` no período → `uniqueLeads.add(deal_id)` + `passagens++`
- Para cada deal do snapshot → `uniqueLeads.add(deal_id)` + `parados++`
- Total exibido = `uniqueLeads.size` (sem dupla contagem)

**3. Agregar por nome normalizado** (resolve fragmentação entre pipelines)

Continuar consolidando "Lead Qualificado" das 17 instâncias diferentes no mesmo bucket via `normalizeStageName(stage.name)`.

**4. Atualizar `StageMovementsSummaryRow`**

Novo formato:
```ts
interface StageMovementsSummaryRow {
  stageId: string;          // representativo (primeiro encontrado)
  stageNameKey: string;     // chave normalizada para seleção
  stageName: string;
  stageOrder: number;
  uniqueLeads: number;      // total acumulado (passou + está lá)
  passagens: number;        // só movimentações no período
  parados: number;          // só snapshot atual
}
```

**5. Atualizar tabela de resumo (`StageMovementsSummaryTable.tsx`)**

Trocar as colunas atuais por:
- **Estágio**
- **Acumulado** (badge primário — número principal)
- **Passaram no período** (badge secundário, menor)
- **Estão no estágio** (badge secundário, menor)

Tooltip explicando: "Acumulado = leads únicos que passaram pelo estágio no período + leads que estão no estágio hoje".

**6. Ajustar filtro de detalhe (`MovimentacoesEstagio.tsx`)**

A tabela de detalhe hoje só lista linhas de `deal_activities`. Vou ampliar o `rows` retornado pelo hook para incluir também os deals do snapshot que NÃO tiveram movimentação no período, marcados com:
- `when = null` (não tem data de movimentação)
- `fromStageName = null`
- Tag visual "Sem movimentação no período (parado)"

Ao clicar num estágio do resumo, o detalhe mostra todos os leads (movimentados + parados) que compõem o número acumulado daquele estágio.

**7. Filtro de seleção por nome**

`selectedStageId` vira `selectedStageNameKey`. O filtro de `detailRows` passa a comparar pela chave normalizada do estágio (do snapshot ou da movimentação).

### Garantias

- **Funil fica coerente**: estágios anteriores tendem a ter acumulado >= estágios posteriores (não é garantido por inferência, mas reflete a realidade quando o time não pula etapas)
- **Lead Qualificado deixa de subcontar** porque agora soma quem passou + quem está parado lá
- **Sem dupla contagem**: Set por `deal_id` garante que lead que passou e voltou não infla o número
- **Zero migration, zero RLS**: tudo cliente
- **Hook usado em 1 lugar só** (`/crm/movimentacoes`)
- **Outras telas inalteradas**

### Limites conhecidos

- Continua dependente do limite de 10.000 atividades. Para períodos muito longos sem filtro de pipeline, pode cortar (warning no console já existe).
- Snapshot de `crm_deals` também segue o limite default do Supabase (1000) — vou paginar com chunks se necessário (padrão já usado no hook).
- Não infere pulos: se a operação pula etapas frequentemente, alguns estágios intermediários ainda parecem subcontados (decisão consciente sua para manter fidelidade).

### Validação

1. `/crm/movimentacoes`, Inside Sales, últimos 30 dias:
   - "Lead Qualificado" mostra acumulado coerente com volume operacional (centenas/milhar, não 35)
   - Estágios seguintes mostram números menores ou iguais (funil)
2. Tabela de resumo mostra 3 colunas: Acumulado / Passaram / Estão no estágio
3. Clicar em "Lead Qualificado" → detalhe lista leads movimentados E leads parados nesse estágio
4. Soma de "Passaram + Estão" pode ser > "Acumulado" (correto: lead que passou e ficou conta uma vez no acumulado)
5. Validar contra SQL:
   ```sql
   SELECT COUNT(DISTINCT deal_id) FROM (
     SELECT deal_id FROM deal_activities da
       JOIN crm_stages s ON (s.id::text=da.to_stage OR s.clint_id=da.to_stage)
       WHERE da.activity_type='stage_change'
         AND da.created_at >= now() - interval '30 days'
         AND lower(s.stage_name) LIKE '%qualific%'
     UNION
     SELECT id FROM crm_deals d
       JOIN crm_stages s ON s.id=d.stage_id
       WHERE lower(s.stage_name) LIKE '%qualific%'
   ) t;
   ```
   Número da tela bate com esse query.

### Escopo

- 1 hook refatorado: `src/hooks/useStageMovements.ts` (+ snapshot query, agregação unificada por nome)
- 1 tabela ajustada: `src/components/crm/StageMovementsSummaryTable.tsx` (3 colunas)
- 1 tabela ajustada: `src/components/crm/StageMovementsDetailTable.tsx` (linha "parado", sem data)
- 1 página ajustada: `src/pages/crm/MovimentacoesEstagio.tsx` (filtro por nameKey)
- Zero migration, zero RLS, zero edge function

