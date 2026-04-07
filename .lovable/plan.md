

# Fix: Deals A010 nao estao sendo criados via Hubla

## Problema identificado

Todos os leads A010 que compram pela Hubla desde recentemente **nao estao gerando deals no CRM**. Auditei as transacoes de hoje e confirmei:

- **~16 leads A010 de hoje** tem transacao registrada mas **0 deals criados**
- O contato e criado corretamente, mas o deal nao
- Apenas 2 leads tinham deals, e ambos foram criados por OUTRAS fontes (Make e Consorcio), nao pelo fluxo A010

## Causa raiz

O `hubla-webhook-handler` usa `upsert` com `onConflict: 'contact_id,origin_id'` para criar deals (linha 625). Porem, a unica constraint que corresponde a esses campos e um **indice unico parcial**:

```sql
CREATE UNIQUE INDEX crm_deals_contact_origin_unique 
ON crm_deals (contact_id, origin_id) 
WHERE contact_id IS NOT NULL AND origin_id IS NOT NULL AND data_source = 'webhook';
```

PostgreSQL **nao consegue resolver** `ON CONFLICT (contact_id, origin_id)` para um indice parcial sem a clausula WHERE. O upsert falha com erro de "no unique constraint matching", que e capturado silenciosamente no catch (linha 635-641) e nao e re-thrown. O fallback (INSERT direto na linha 660) tambem pode nao executar corretamente dependendo do fluxo.

## Solucao

No `supabase/functions/hubla-webhook-handler/index.ts`, **substituir o `upsert`** por uma logica de **check-then-insert** que ja e usada parcialmente como fallback:

1. **Remover o `upsert`** na linha 623-630
2. **Usar INSERT direto** com tratamento de erro para `23505` (duplicata)
3. O check de deal existente ja acontece antes (linha 451-467), entao o INSERT so executa se realmente nao existir deal

### Alteracao especifica

```typescript
// ANTES (linha 623-630):
const { data: newDeal, error: dealError } = await supabase
  .from('crm_deals')
  .upsert(dealData, {
    onConflict: 'contact_id,origin_id',
    ignoreDuplicates: true
  })
  .select('id')
  .maybeSingle();

// DEPOIS:
const { data: newDeal, error: dealError } = await supabase
  .from('crm_deals')
  .insert(dealData)
  .select('id')
  .maybeSingle();
```

E simplificar o tratamento de erro para lidar com duplicatas `23505` (que o check anterior ja deveria prevenir).

### Arquivo
| Arquivo | Acao |
|---------|------|
| `supabase/functions/hubla-webhook-handler/index.ts` | Substituir upsert por INSERT direto na criacao de deals (~linha 623) |

### Apos deploy
- Rodar um script de recuperacao para criar deals para os ~16+ leads A010 de hoje que ficaram sem deal

