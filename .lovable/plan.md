

## Plano: Corrigir classificação ANAMNESE usando deal_activities (stage UUID + nome)

### Problema

A detecção de leads ANAMNESE via tags/origin falha porque:
- Tags nunca contêm "anamnese" (ex: Heloiza tem tags SDR-JO, A000-Contrato)
- Origin é sempre "PIPELINE INSIDE SALES" (ou outra pipeline genérica)
- O caminho correto é verificar se o deal **passou por um stage de anamnese** via `deal_activities`

### Descoberta no banco

- `deal_activities.from_stage` e `to_stage` são `text` e armazenam **tanto UUIDs quanto nomes de stages**
- Stage ANAMNESE INCOMPLETA tem UUID `e6fab26d-f16d-4b00-900f-ca915cbfe9d9`
- Existem registros com `to_stage = 'ANAMNESE COMPLETA'` e `to_stage = 'ANAMNESE INCOMPLETA'` (como texto)
- Heloiza (deal `b0a81eb8`) tem `from_stage = 'e6fab26d...'` (UUID do stage ANAMNESE INCOMPLETA) -- confirmado no banco
- Ela está na R2 agenda (slot_date 2026-04-10), mas a classificação atual mostra 0 ANAMNESE

### Alteração em `supabase/functions/weekly-manager-report/index.ts`

**Substituir** a lógica de classificação ANAMNESE (linhas 408-468) para usar `deal_activities` em vez de tags/origin:

```ts
// 1. Buscar IDs dos stages de anamnese
const { data: anamnaseStages } = await supabase
  .from('crm_stages')
  .select('id')
  .ilike('stage_name', '%anamnes%');
const anamnaseStageIds = new Set(
  (anamnaseStages || []).map((s: any) => s.id)
);

// 2. Buscar deal_activities dos R2 deals
const { data: dealActivities } = await supabase
  .from('deal_activities')
  .select('deal_id, to_stage, from_stage')
  .in('deal_id', r2DealIds);

// 3. Criar set de deals que passaram por anamnese
//    Verificar tanto por UUID do stage quanto por nome textual
const anamneseDealIds = new Set<string>();
for (const da of dealActivities || []) {
  const toStage = da.to_stage || '';
  const fromStage = da.from_stage || '';
  if (
    anamnaseStageIds.has(toStage) || anamnaseStageIds.has(fromStage) ||
    toStage.toUpperCase().includes('ANAMNES') ||
    fromStage.toUpperCase().includes('ANAMNES')
  ) {
    anamneseDealIds.add(da.deal_id);
  }
}

// 4. Na classificação: A010 > ANAMNESE > LIVE
if (email && a010EmailSet.has(email)) originA010++;
else if (att.deal_id && anamneseDealIds.has(att.deal_id)) originAnamnese++;
else originLive++;
```

### Também corrigir (do plano anterior aprovado)

- **R2 Agendadas**: contar todos os `r2NonPartner` (remover filtro de status)
- **R2 Realizadas**: contar todos exceto no-shows reais (`att.status === 'no_show'` e slot não completed)

### Deploy e teste

Enviar apenas para Bellini (`buFilter: "incorporador"`) para validar.

### Resultado esperado

- R2 Agendadas: **52**
- R2 Realizadas: **45**
- Origem: A010 com prioridade, ANAMNESE detectada via histórico de stages (Heloiza e outros), LIVE para os demais

