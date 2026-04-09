

# Bloquear leads A010 de entrarem em pipelines que não sejam Inside Sales

## Problema

Leads que já compraram A010 estão sendo criados na pipeline "PILOTO ANAMNESE / INDICAÇÃO" via webhooks de anamnese (completa ou incompleta). Esses leads deveriam ficar exclusivamente na PIPELINE INSIDE SALES.

## Solução

Adicionar verificação de compra A010 em dois pontos:

### 1. Edge Function `webhook-lead-receiver` (proteção na entrada)

Após resolver o contato (seção 7) e antes de criar o deal (seção 11), adicionar check:

- Se o `origin_id` do endpoint **não** é o da PIPELINE INSIDE SALES
- Verificar se o email/telefone do lead tem transação confirmada em `hubla_transactions` com `product_category = 'a010'` e `sale_status = 'completed'`
- Se sim: **bloquear criação** na pipeline atual
- Em vez disso, verificar se já existe deal na Inside Sales. Se não, criar lá (com owner via round-robin). Se sim, apenas atualizar o profile
- Retornar resposta indicando redirecionamento

```text
Fluxo:
  1. Resolver contato (existente)
  2. Verificar se origin_id != INSIDE_SALES_ORIGIN
  3. Se diferente → checar hubla_transactions por A010 completed
  4. Se tem A010:
     a. Buscar origin_id da PIPELINE INSIDE SALES
     b. Checar se já tem deal lá → se sim, atualizar profile e retornar
     c. Se não tem deal → criar deal na Inside Sales (não na pipeline do endpoint)
     d. Log: "Lead A010 redirecionado para Inside Sales"
  5. Se não tem A010 → fluxo normal
```

### 2. Frontend `BulkMovePipelineDialog` (proteção na movimentação manual)

Antes de mover cada deal, verificar se o lead tem tag A010 ou compra A010. Se o destino não é Inside Sales, bloquear e avisar via toast.

| Arquivo | Alteração |
|---|---|
| `supabase/functions/webhook-lead-receiver/index.ts` | Adicionar check A010 antes da criação do deal (~linha 515), com redirecionamento para Inside Sales |
| `src/components/crm/BulkMovePipelineDialog.tsx` | Adicionar check A010 no loop de `handleMove`, bloqueando movimentação para fora de Inside Sales |

### Detalhes técnicos

**No webhook-lead-receiver**, a query de verificação:
```sql
SELECT id FROM hubla_transactions 
WHERE product_category = 'a010' 
  AND sale_status = 'completed'
  AND (customer_email = :email OR customer_phone LIKE '%' || :phone9)
LIMIT 1
```

**No BulkMovePipelineDialog**, usar o email do contato do deal para verificar contra `hubla_transactions` antes de permitir o move. Deals com A010 sendo movidos para fora de Inside Sales serão contabilizados como "bloqueados" com toast explicativo.

