

## Bug Fix: Coluna errada na busca do estágio "Lead Gratuito"

### Problema encontrado nos testes

Os 3 fluxos foram testados e 2 de 3 funcionaram corretamente:

| Fluxo | Resultado | Status |
|-------|-----------|--------|
| Incompleto (entrada) | Owner = Antony, tag = ANAMNESE-INCOMPLETA, estágio = ANAMNESE INCOMPLETA | OK |
| Incompleto → Completo | Owner = Antony (preservado), tags = ANAMNESE-INCOMPLETA + ANAMNESE, **estágio NÃO mudou** | BUG |
| Completo direto | Owner = Carol (distribuição), tag = ANAMNESE, estágio = Lead Gratuito | OK |
| Incompleto sem completar | Owner = Antony, tag = ANAMNESE-INCOMPLETA, estágio = ANAMNESE INCOMPLETA | OK |

### Causa do bug

Na linha 368 do `webhook-lead-receiver/index.ts`, a query busca o estágio usando `.ilike('name', 'Lead Gratuito')`, mas a coluna correta é `stage_name`:

```
// ERRADO (atual)
.ilike('name', 'Lead Gratuito')

// CORRETO
.ilike('stage_name', 'Lead Gratuito')
```

O `.maybeSingle()` retornou `null` silenciosamente, e o fallback `leadGratuitoStage?.id || existingDeal.stage_id` manteve o estágio original.

### Correção

**Arquivo**: `supabase/functions/webhook-lead-receiver/index.ts`, linha 368

Trocar `.ilike('name', 'Lead Gratuito')` por `.ilike('stage_name', 'Lead Gratuito')`

Depois, re-testar o fluxo incompleta → completa para confirmar que o deal move para o estágio correto (`d346320a-00b0-4e9f-89b6-149ad1c34061`).

### Limpeza

Remover os 3 deals de teste criados durante a validação.

