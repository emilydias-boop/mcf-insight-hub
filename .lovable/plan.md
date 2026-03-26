

## Proteger leads existentes na importação — só adicionar informações, sem mover owner/stage

### Problema atual

Quando a importação encontra leads **já na pipeline** (found_in_current) **sem reunião**, o sistema:
- **Transfere o owner** para o SDR selecionado (via `bulkTransfer`)
- **Altera o stage** se um estágio foi selecionado

O correto é: leads já existentes devem **apenas receber tags e informações adicionais**, sem alterar owner nem stage.

### Mudanças

**Arquivo 1: `src/components/crm/SpreadsheetCompareDialog.tsx`** (linhas 396-458)
- Remover a chamada de `bulkTransfer` para leads `found_in_current` (tanto single quanto distribute)
- Manter apenas a atualização de **tags** para todos os deals existentes (com ou sem reunião)
- Remover a distinção "com reunião / sem reunião" — todos recebem o mesmo tratamento: só tags

Lógica nova para `found_in_current`:
```typescript
// Todos os deals existentes: só atualizar tags (preservar stage e owner)
if (inCurrent.length > 0) {
  const allDealIds = inCurrent.map(r => r.localDealId!);
  if (tags?.length) {
    await supabase
      .from('crm_deals')
      .update({ tags: [...new Set(['base clint', ...tags])] })
      .in('id', allDealIds);
  }
  updatedCount += inCurrent.length;
  toast.info(`${inCurrent.length} leads já existentes — apenas tags atualizadas (owner e estágio preservados)`);
}
```

**Arquivo 2: `supabase/functions/import-spreadsheet-leads/index.ts`** (linhas 146-183)
- Para deals existentes: **só atualizar tags**, remover update de `owner_id`, `owner_profile_id` e `stage_id`
- Remover check de `meeting_slots` (não é mais necessário, todos são protegidos)

Lógica nova:
```typescript
if (existingDeal?.length) {
  // Deal já existe: só atualizar tags, preservar owner e stage
  const { error: updateError } = await supabase
    .from('crm_deals')
    .update({ tags: finalTags })
    .eq('id', existingDeal[0].id);
  // ...
  updated++;
  continue;
}
```

### O que NÃO muda
- **found_elsewhere** (contato existe em outra pipeline): continua criando deal novo na pipeline atual com owner/stage selecionados
- **not_found** (novos): continua criando contato + deal com todas as informações
- **Deduplicação**: continua funcionando por email → telefone 9 dígitos → telefone 8 dígitos

### Resumo do comportamento final

| Categoria | Owner | Stage | Tags | Contato |
|-----------|-------|-------|------|---------|
| Já na pipeline | ❌ preserva | ❌ preserva | ✅ adiciona | ❌ preserva |
| Outra pipeline | ✅ define | ✅ define | ✅ adiciona | ❌ reutiliza |
| Novo | ✅ define | ✅ define | ✅ adiciona | ✅ cria |

