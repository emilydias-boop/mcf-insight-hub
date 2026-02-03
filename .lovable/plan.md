# ✅ Plano Concluído: Corrigir Duplicação de Leads A010

## Problema Identificado

Os leads A010 entravam pelo webhook da Hubla e estavam sendo duplicados devido a uma **race condition**. A Hubla envia múltiplos webhooks simultaneamente para a mesma compra.

## Solução Implementada

### ✅ Etapa 1: Índice Único no Banco

Criado índice único parcial para prevenir duplicados:

```sql
CREATE UNIQUE INDEX crm_deals_contact_origin_unique 
ON crm_deals (contact_id, origin_id) 
WHERE contact_id IS NOT NULL 
  AND origin_id IS NOT NULL 
  AND data_source = 'webhook';
```

### ✅ Etapa 2: hubla-webhook-handler com Upsert Atômico

Substituído SELECT+INSERT por UPSERT com `ignoreDuplicates: true`:

```typescript
const { data: newDeal, error: dealError } = await supabase
  .from('crm_deals')
  .upsert(dealData, {
    onConflict: 'contact_id,origin_id',
    ignoreDuplicates: true
  })
  .select('id')
  .maybeSingle();
```

### ✅ Etapa 3: Limpeza de Duplicados Existentes

Duplicados limpos com a seguinte lógica:
- Deals com mais atividades/reuniões foram preservados
- Quando ambos tinham atividades, mantido o com mais atividades
- Meeting attendees foram movidos para o deal correto antes da deleção

## Resultado

| Cenário | Status |
|---------|--------|
| Novos webhooks simultâneos | ✅ Constraint + Upsert previnem duplicação |
| Duplicados existentes | ✅ Limpos mantendo deals trabalhados |
| Meeting attendees | ✅ Preservados no deal correto |
