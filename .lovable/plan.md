

# Corrigir leads ficando em ambas as pipelines

## Problema

Quando o bulk move encontra um conflito de unique constraint (contato já existe na pipeline destino), o código atual:
1. Atualiza o deal **existente** na pipeline destino com os dados mesclados
2. **Mas não remove o deal de origem** da pipeline original

Resultado: o lead aparece nas duas pipelines.

## Solução

Após atualizar com sucesso o deal existente na pipeline destino, **deletar o deal de origem** da pipeline original. Isso garante que o lead só existe em uma pipeline.

| Arquivo | Alteração |
|---|---|
| `src/components/crm/BulkMovePipelineDialog.tsx` | Após o update do deal existente (linha 103-112), adicionar um DELETE do deal de origem (`dealId`) |

### Detalhe

```typescript
// Após o update do deal existente com sucesso (linha 117):
if (updateError) {
  errors++;
} else {
  // Remover o deal de origem para não ficar duplicado
  await supabase
    .from('crm_deals')
    .delete()
    .eq('id', dealId);
  updated++;
}
```

Isso garante que:
- Caso normal (sem duplicata): deal é movido normalmente (origin_id + stage_id atualizados)
- Caso duplicata: deal existente na destino recebe dados mesclados, deal de origem é removido
- O lead aparece em apenas uma pipeline

