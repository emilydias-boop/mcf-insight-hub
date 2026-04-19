
## Diagnóstico real (confirmado)

Testei a RPC direto via REST e o erro é claro:

```
PGRST203: Could not choose the best candidate function between:
  public.get_carrinho_r2_attendees(p_week_start, p_window_start, p_window_end, p_apply_contract_cutoff)
  public.get_carrinho_r2_attendees(p_week_start, p_window_start, p_window_end, p_apply_contract_cutoff, p_previous_cutoff)
```

A migration anterior **criou uma nova versão** da função em vez de **substituir** a antiga. PostgREST não consegue escolher entre as duas → toda chamada falha → React Query devolve erro → todas as KPIs aparecem 0.

Isso afeta:
- Aba Relatório (`useContractLifecycleReport`)
- Aba Lista, Calendário, Por Sócio, Pendentes, No-Shows, Pré-Agendados, Sem Sucesso (`useCarrinhoUnifiedData`)
- Painel de KPIs do Carrinho R2 (`useR2CarrinhoKPIs`)
- Tudo que consome `useCarrinhoUnifiedData` direta ou indiretamente

Não é problema de front nem de lógica de cutoff — é colisão de assinatura da função no banco.

## Correção

### 1. Migration: dropar a versão antiga
Remover a sobrecarga sem `p_previous_cutoff`:

```sql
DROP FUNCTION IF EXISTS public.get_carrinho_r2_attendees(
  date, timestamptz, timestamptz, boolean
);
```

A versão nova já tem `p_previous_cutoff timestamptz DEFAULT NULL`, então chamadas que não enviam o parâmetro continuam funcionando (cai no DEFAULT NULL).

### 2. Validação esperada
- Imediatamente após a migration: PostgREST resolve para a única função restante.
- `useCarrinhoUnifiedData` volta a popular os cards.
- `useContractLifecycleReport` volta a popular o Relatório.
- A regra de `dentro_corte` com `p_previous_cutoff` continua valendo (já está implementada na função nova e o hook unified já passa o parâmetro).
- Hooks que ainda não passam `p_previous_cutoff` (ex: `useContractLifecycleReport`) usam o default NULL → comportamento equivale à versão sem cutoff prévio (igual antes da última migration), o que é seguro.

### Escopo
- 1 migration (DROP da versão antiga). Nada de front.

### Por que não mexer no front
Os hooks já estão chamando com o parâmetro correto na versão nova. Mexer no front sem dropar a versão antiga não resolve, porque o erro `PGRST203` acontece independente do payload — é o resolver de função do PostgREST que rejeita.
