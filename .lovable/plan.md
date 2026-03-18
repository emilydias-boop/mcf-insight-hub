

## Problema

Quando o webhook da anamnese (ClientData Inside) recebe um lead que já tem deal na pipeline, ele atualiza o `lead_profile` mas **não adiciona a tag ANAMNESE** ao deal existente. Isso afeta 2 deals identificados:

- **Aline Melo** (deal `ea384e5a...`)
- **Júlio Gil Simões Freire** (deal `60c5c59f...`)

Os outros 3 deals criados pelo webhook já têm a tag corretamente.

## Solução (2 partes)

### 1. Correção de dados — Adicionar tag ANAMNESE aos 2 deals

UPDATE nos deals existentes para incluir a tag:

```sql
UPDATE crm_deals SET tags = array_append(COALESCE(tags, '{}'), 'ANAMNESE')
WHERE id IN (
  'ea384e5a-fd2e-42cc-9ca3-01ebe02be56a',
  '60c5c59f-27d7-4412-bec5-860893598d59'
) AND NOT ('ANAMNESE' = ANY(COALESCE(tags, '{}')));
```

### 2. Correção no código — Webhook aplicar auto_tags em deals duplicados

**Arquivo:** `supabase/functions/webhook-lead-receiver/index.ts` (linhas 267-284)

No bloco de deduplicação (`if (existingDeal)`), antes de retornar, adicionar lógica para mesclar as `autoTags` do endpoint nas tags do deal existente:

```typescript
if (existingDeal) {
  // Atualiza lead_profile (já existente)
  await upsertLeadProfile(...);
  
  // NOVO: Adicionar auto_tags ao deal existente
  if (autoTags.length > 0) {
    const { data: currentDeal } = await supabase
      .from('crm_deals')
      .select('tags')
      .eq('id', existingDeal.id)
      .single();
    
    const currentTags = currentDeal?.tags || [];
    const newTags = [...new Set([...currentTags, ...autoTags])];
    
    if (newTags.length !== currentTags.length) {
      await supabase
        .from('crm_deals')
        .update({ tags: newTags })
        .eq('id', existingDeal.id);
    }
  }
  
  await updateEndpointMetrics(...);
  return new Response(...);
}
```

Assim, futuros leads deduplicados também receberão a tag automaticamente.

