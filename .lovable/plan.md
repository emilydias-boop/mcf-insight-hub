
# Diagnóstico

- Não é só front.
- O fechamento que você abriu está na rota `/fechamento-sdr/0178c7bc-51df-4e58-bbc5-b0c7e49bb260`, então essa tela usa o fluxo de SDR padrão (`sdr_month_payout` + `sdr_comp_plan`), não o fluxo `consorcio_closer_payout`.
- No banco, para esse registro, hoje está assim:
  - `cargos_catalogo.fixo_valor = 3150`
  - `sdr_comp_plan.fixo_valor = 3200`
  - `sdr_month_payout.valor_fixo = 3200`

Ou seja: o front está exibindo um valor que já está salvo defasado no banco.

# Causa raiz

1. `src/pages/fechamento-sdr/Detail.tsx` prioriza `compPlan.fixo_valor` na exibição.
2. A edge function `supabase/functions/recalculate-sdr-payout/index.ts` até busca o `cargos_catalogo`, mas só usa os valores do cargo como fallback quando não existe `sdr_comp_plan`.
3. Como existe um comp plan vigente com `3200`, o recálculo continua usando `3200` e grava `3200` de novo no payout.

# Plano de correção

1. Ajustar `supabase/functions/recalculate-sdr-payout/index.ts`
   - comparar `sdr_comp_plan` vigente com `cargos_catalogo`
   - se `fixo_valor`, `variavel_total` ou `ote_total` divergirem, sincronizar antes de calcular
   - recalcular o `sdr_month_payout` já com os valores atualizados do cargo

2. Ajustar `src/pages/fechamento-sdr/Detail.tsx`
   - manter a tela coerente com o dado recalculado
   - opcional: exibir aviso visual quando RH e comp plan estiverem divergentes, para deixar claro que o problema é de sincronização e não mascarar no front

3. Garantir refetch após recálculo
   - invalidar/recarregar `sdr-payout-detail` e `sdr-comp-plan` para o valor de `3150` aparecer imediatamente

# Detalhe técnico

```text
Fluxo atual:
Cargo RH (3150) -> Comp Plan vigente (3200) -> recalculate-sdr-payout usa comp plan -> payout fica 3200 -> tela mostra 3200

Fluxo correto:
Cargo RH (3150) -> edge function detecta divergência -> sincroniza comp plan -> recalcula payout -> tela mostra 3150
```

# Resultado esperado

- O Fixo do Cleiton passa para `R$ 3.150,00`
- O Total Conta é recalculado com base no novo fixo
- Exportação e demais telas ficam consistentes
- A correção acontece na origem do dado, não só na aparência da tela

# Arquivos principais

- `supabase/functions/recalculate-sdr-payout/index.ts`
- `src/pages/fechamento-sdr/Detail.tsx`
- se necessário, `src/hooks/useSdrFechamento.ts` e/ou `src/hooks/useSdrKpiMutations.ts`
