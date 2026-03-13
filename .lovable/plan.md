

## Fix: Backfill deals com stage_id NULL → "Novo Lead"

### Problema
Os 169 deals criados pelo backfill ficaram com `stage_id = NULL` porque a query usou `.ilike('name', ...)` mas a coluna correta é `stage_name`.

### Solução (2 partes)

**1. Corrigir os 169 deals existentes**

Atualizar diretamente via a edge function `fix-null-stages`. Porém essa function pega o primeiro estágio por `stage_order` (que seria "Lead Gratuito", order 1). Precisamos de uma abordagem específica:

Alterar a função `fix-null-stages/index.ts` para, quando o origin for PIPELINE INSIDE SALES, usar especificamente o estágio "Novo Lead" em vez do primeiro por ordem. Ou, mais simples: apenas corrigir no `backfill-a010-offer-leads` e re-rodar.

**Abordagem escolhida**: Corrigir o bug no `backfill-a010-offer-leads/index.ts` (coluna `name` → `stage_name`) e fazer um UPDATE direto dos 169 deals existentes.

**2. Fix no `backfill-a010-offer-leads/index.ts`**

Linha ~56: trocar `.ilike('name', '%Novo Lead%')` por `.ilike('stage_name', '%Novo Lead%')`

**3. UPDATE dos 169 deals**

```sql
UPDATE crm_deals 
SET stage_id = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b'
WHERE tags @> ARRAY['Backfill-Offer'] 
  AND stage_id IS NULL;
```

Isso coloca todos os 169 deals do backfill na stage "Novo Lead" — todos são de fato novos (nenhum tem histórico de atividades/movimentações).

### Escopo
- Fix: `supabase/functions/backfill-a010-offer-leads/index.ts` (coluna `name` → `stage_name`)
- Migration SQL: UPDATE dos 169 deals para stage "Novo Lead"

