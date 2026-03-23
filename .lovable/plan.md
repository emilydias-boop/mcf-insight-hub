

## Plano: Corrigir devolução silenciosa de equipamento

### Diagnóstico

Identifiquei dois problemas nos network requests:

**1. Query de assignments quebrada (HTTP 300)**
A query `useAssetAssignments` usa `termo:asset_terms(*)` mas existem duas foreign keys entre `asset_assignments` e `asset_terms` (`asset_terms_assignment_id_fkey` e `asset_assignments_termo_id_fkey`). O PostgREST retorna erro 300 "ambiguous relationship" e a query falha silenciosamente.

**2. Erro engolido no dialog de devolução**
O `AssetReturnDialog.handleSubmit` tem um `catch {}` vazio. Como usa `mutateAsync`, quando o mutation falha a exceção vai para o caller, mas o catch vazio a engole -- nenhum toast de erro aparece e o dialog não fecha.

### Alterações

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/useAssetAssignments.ts` (linhas 24, 48) | Desambiguar o join: `termo:asset_terms!asset_assignments_termo_id_fkey(*)` |
| `src/components/patrimonio/AssetReturnDialog.tsx` (linha 69) | Remover catch vazio para que o `onError` do mutation exiba o toast de erro |

### Detalhe tecnico

**useAssetAssignments.ts** linha 24:
```typescript
// De:
termo:asset_terms(*)
// Para:
termo:asset_terms!asset_assignments_termo_id_fkey(*)
```

**AssetReturnDialog.tsx** linhas 65-70:
```typescript
// De:
try {
  await returnAsset.mutateAsync({...});
  onOpenChange(false);
} catch {
  // handled in hook
}

// Para:
await returnAsset.mutateAsync({...});
onOpenChange(false);
```
Removendo o try/catch, o `onError` do hook será chamado corretamente e exibirá o toast de erro. O `finally` continua tratando o `isSubmitting`.

### Resultado esperado

- A query de assignments para de retornar 300 e carrega os dados corretamente
- Se a devolução funcionar: toast de sucesso + dialog fecha
- Se falhar: toast de erro visível ao usuario

