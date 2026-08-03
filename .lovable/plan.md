# Reentrada de lead: mover stage do negócio existente (Inside Sales / Incorporador)

## Confirmação da dúvida da stage "Anamnese"

O id `e6fab26d-f16d-4b00-900f-ca915cbfe9d9` (origin Inside Sales) tem nome divergente entre as tabelas:

| Tabela | Nome |
|---|---|
| `crm_stages` | ANAMNESE INCOMPLETA |
| `local_pipeline_stages` | ANAMNESE COMPLETA |

O Kanban exibe o nome de **`local_pipeline_stages`**: em `src/hooks/useCRMData.ts` (`fetchStages`), quando existem local stages para a origem elas são a única fonte de verdade (`return mergedStages`, linha 157) e o nome vem de `s.name`. Portanto na tela aparece **ANAMNESE COMPLETA** — é o comportamento desejado. A divergência em `crm_stages` é um bug de nomenclatura à parte (só afeta lugares que leem `crm_stages.stage_name`, ex.: buscas por nome dentro de edge functions). Recomendo renomear `crm_stages.stage_name` para "ANAMNESE COMPLETA" nesse id em migração separada — fora do escopo desta regra, e só depois de você confirmar.

Nada disso muda o alvo desta regra: a movimentação usará o id fixo, não o nome.

## Onde está a lógica hoje

`supabase/functions/webhook-lead-receiver/index.ts`:

- Linhas 729–750: bloco "8. Check for existing deal by identity" — RPC `check_duplicate_deal_by_identity` (email + 9 dígitos do telefone + origin) e depois `select id, tags, stage_id, custom_fields, owner_id, owner_profile_id`.
- Linha 752 `if (existingDeal) { ... }`:
  - 760–844: fluxo especial ANAMNESE-INCOMPLETA → "Lead Gratuito" (só `slug === 'anamnese-mcf'` e tag `ANAMNESE-INCOMPLETA`).
  - 846–876: **fluxo padrão** — só faz `upsertLeadProfile`, merge de `autoTags` e retorna `action: 'updated_profile'`. É aqui que a stage não é movida.
- A trava A010 (linhas ~500–660) e o bloqueio parceiro/renovação (~700–727) rodam **antes** do bloco 8, então continuam intactos.

Configuração atual dos endpoints (tabela `webhook_endpoints`, todos ativos):

- `a010-kiwify`, `lead-guia`, `planilha` → origin Inside Sales, `stage_id = cf4a369c…` (Novo Lead).
- `anamnese-ytb`, `anamnese-ytb-live`, `anamnese-manychat`, `ananmnese-live-insta`, `clientdata-inside` → Inside Sales, `stage_id = e6fab26d…`.
- `anamnese-mcf` → Inside Sales, `stage_id` **null**; `anamnese-insta-mcf` → origin **7431cf4a…** (outra origem), `stage_id` null.

## Implementação proposta

### 1. Mapa de slugs → stage alvo (no topo do arquivo)

```ts
const INSIDE_SALES_ORIGIN_ID = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';
const STAGE_NOVO_LEAD = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b';
const STAGE_ANAMNESE = 'e6fab26d-f16d-4b00-900f-ca915cbfe9d9';
const STAGE_CONTRATO_PAGO = '062927f5-b7a3-496a-9d47-eb03b3d69b10';
const STAGE_VENDA_REALIZADA = '3a2776e2-a536-4a2a-bb7b-a2f53c8941df';

const REENTRY_STAGE_BY_SLUG: Record<string, string> = {
  'a010-kiwify': STAGE_NOVO_LEAD,
  'lead-guia': STAGE_NOVO_LEAD,
  'planilha': STAGE_NOVO_LEAD,
  'anamnese-ytb': STAGE_ANAMNESE,
  'anamnese-ytb-live': STAGE_ANAMNESE,
  'anamnese-manychat': STAGE_ANAMNESE,
  'ananmnese-live-insta': STAGE_ANAMNESE,
  'clientdata-inside': STAGE_ANAMNESE,
  'anamnese-mcf': STAGE_ANAMNESE,
  'anamnese-insta-mcf': STAGE_ANAMNESE,
};
```

A regra só é aplicada quando `endpoint.origin_id === INSIDE_SALES_ORIGIN_ID` (garante que fica restrita ao Kanban da BU Incorporador; `anamnese-insta-mcf` está em outra origem e portanto será ignorado hoje — me diga se quer incluí-lo mesmo assim).

### 2. Checagem das 3 proteções em 2 queries (sem N+1)

Helper `canMoveExistingDeal(supabase, dealId, currentStageId)`:

1. Condição 3 é local, sem query: `currentStageId` em `[STAGE_CONTRATO_PAGO, STAGE_VENDA_REALIZADA]` → bloqueia.
2. Query A: `hubla_transactions` → `select id`, `.eq('linked_deal_id', dealId)`, `.eq('sale_status','completed')`, filtro de produto `.or('product_name.ilike.%A000%,product_category.eq.contrato')`, `.limit(1)`. Havendo linha → bloqueia.
3. Query B: `meeting_slot_attendees` → `select id`, `.eq('deal_id', dealId)`, `.not('contract_paid_at','is',null)`, `.limit(1)`. Havendo linha → bloqueia.

São no máximo 2 queries por requisição (curto-circuito: se A bloqueia, B não roda), ambas por índice em `linked_deal_id` / `deal_id`.

### 3. Aplicar no fluxo padrão (linhas 846–876)

Antes de retornar `updated_profile`:

- Resolver `targetStageId` pelo mapa; se não houver, comportamento atual inalterado.
- Se `targetStageId === existingDeal.stage_id`, nada a fazer (evita `stage_moved_at` falso).
- Rodar `canMoveExistingDeal`. Se bloqueado: mantém a stage e só atualiza dados (log + campo na resposta `stage_move_skipped: '<motivo>'`).
- Se liberado: `update crm_deals { stage_id: targetStageId, stage_moved_at: now() }` e insert em `deal_activities` (`activity_type: 'stage_change'`, description tipo "Reentrada via webhook <slug> → <stage>", metadata com `from_stage_id`, `to_stage_id`, `trigger: 'webhook_reentry'`, `slug`).
- O merge de tags/`upsertLeadProfile` já existentes continuam iguais; o update de stage será unido ao mesmo `update` das tags quando ambos ocorrerem, para não fazer dois writes.
- Resposta passa a incluir `action: 'updated_profile'` + `stage_moved: true/false` e `new_stage_id`, mantendo compatibilidade.

### 4. O que NÃO muda

- Fluxo ANAMNESE-INCOMPLETA → "Lead Gratuito" (`anamnese-mcf` com a tag) continua tendo precedência, como hoje.
- Trava A010, bloqueio parceiro/renovação, dedupe de contato/negócio, criação de deal novo: intocados.
- Owner/SDR do deal existente é preservado (nenhuma redistribuição).
- Nenhuma migração de banco necessária para esta regra (a renomeação de `crm_stages.stage_name` fica pendente da sua confirmação).

## Validação após aplicar

- Teste do endpoint em ambiente real com um deal existente fora de estágio pago → confirmar movimentação + `deal_activities`.
- Teste com um deal em "Contrato Pago" e com um deal com `contract_paid_at` → confirmar `stage_move_skipped` e stage intacta.
- Conferir logs da função para ausência de erros e contagem de queries.
