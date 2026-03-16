

## Plano: Corrigir timeout da Edge Function "Mover Parceiros"

### Problema

A Edge Function encontrou **1913 deals de parceiros** para mover, mas está sofrendo **timeout** (~60s) porque:
1. Atualiza deals **um por um** (2 queries por deal = ~3800 queries)
2. No dry_run, retorna um array com 1913 objetos de detalhes, o que também é lento
3. O dialog mostra vazio porque a resposta nunca chega

### Solução

Reescrever a Edge Function para usar **batch updates** e otimizar o fluxo:

**Edge Function (`supabase/functions/move-partners-to-venda-realizada/index.ts`)**:

1. **Dry run simplificado**: Retornar apenas os stats (contagens) + primeiros 50 exemplos no `details`, sem listar todos os 1.9k
2. **Batch update por stage**: Agrupar deals pelo `targetStageId` e fazer um único `UPDATE ... IN (ids)` por grupo em vez de 1913 updates individuais
3. **Batch insert activities**: Inserir `deal_activities` em batches de 100 em vez de um por um
4. **Tags**: Fazer update de tags em batch separado (deals que já têm vs não têm a tag "Parceiro")

**Componente (`MovePartnersButton.tsx`)**:
- Sem mudanças necessárias, apenas a função precisa responder mais rápido

### Detalhes técnicos

Fluxo otimizado:
```text
1. Identificação (igual ao atual) → stats
2. Dry run: retorna stats + 50 exemplos
3. Execução real:
   a. Agrupar deals por target_stage_id
   b. Para cada grupo: UPDATE crm_deals SET stage_id=X WHERE id IN (batch de 200)
   c. Batch insert deal_activities (100 por vez)
   d. Retornar stats
```

### Arquivos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/move-partners-to-venda-realizada/index.ts` | Reescrever com batch updates |

Após editar, a função será redeployada.

