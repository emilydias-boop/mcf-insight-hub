

# Corrigir OTE da Thayna na listagem de Março

## Problema

A listagem mostra R$8.000 para Thayna em vez de R$9.000 porque existe um comp_plan antigo de Janeiro/2026 (`4884ed45`) com `vigencia_fim = NULL` que nunca foi fechado. A query retorna múltiplos planos válidos e o `find()` pega o primeiro (o antigo de R$8.000) em vez do correto de Março (R$9.000).

## Causa raiz

A migração anterior fechou apenas o plano de Fevereiro (`486d6384`), mas o plano original de Janeiro (`4884ed45`) ficou aberto com `vigencia_fim = NULL`, competindo com o plano N3 de Março.

## Correções

### 1. Fechar o plano antigo de Janeiro (migração SQL)

Atualizar o comp_plan `4884ed45` para `vigencia_fim = 2026-02-28`, eliminando a sobreposição.

### 2. Melhorar `getCompPlanForSdr` no Index.tsx

Alterar a função para, quando houver múltiplos planos válidos, preferir o com `vigencia_inicio` mais recente (mais específico para o mês). Isso previne o mesmo bug caso ocorra novamente com outros SDRs.

```typescript
const getCompPlanForSdr = (sdrId: string) => {
  const plans = compPlans?.filter((cp) => cp.sdr_id === sdrId);
  if (!plans || plans.length === 0) return undefined;
  // Prefer most recent vigencia_inicio (most specific plan)
  return plans.sort((a, b) => 
    b.vigencia_inicio.localeCompare(a.vigencia_inicio)
  )[0];
};
```

| Arquivo | Alteração |
|---|---|
| `supabase/migrations/*.sql` | Fechar comp_plan `4884ed45` com `vigencia_fim = 2026-02-28` |
| `src/pages/fechamento-sdr/Index.tsx` | `getCompPlanForSdr` retorna plano mais recente |

