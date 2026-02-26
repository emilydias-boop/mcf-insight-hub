

## Plano: Edição direta do payout para fechamento manual

### Problema
Yanca já está marcada como "Manual", mas a tela de detalhe ainda mostra apenas o formulário de KPIs padrão + "Salvar e Recalcular". Como a Edge Function pula o cálculo, nada acontece ao salvar. Falta uma seção para editar diretamente os valores do payout.

### Solução
Adicionar um formulário "Valores do Payout" que aparece **apenas** quando `fechamento_manual === true`. Esse formulário permite editar diretamente `valor_variavel_total`, `valor_fixo`, `total_conta`, `ifood_mensal` e `ifood_ultrameta` com um botão "Salvar" que grava direto em `sdr_month_payout` (sem passar pela Edge Function).

### Etapas

**1. Criar componente `ManualPayoutForm`**
- Novo arquivo: `src/components/sdr-fechamento/ManualPayoutForm.tsx`
- Campos editáveis: Valor Fixo, Valor Variável, iFood Mensal, iFood Ultrameta
- Total Conta calculado automaticamente (Fixo + Variável)
- Total iFood calculado automaticamente (Mensal + Ultrameta)
- Botão "Salvar Valores" que faz UPDATE direto em `sdr_month_payout`

**2. Criar hook `useUpdateManualPayout`**
- Novo em `src/hooks/useSdrKpiMutations.ts`
- Mutation que faz `supabase.from('sdr_month_payout').update(...)` com os campos editados
- Invalida cache do payout após salvar

**3. Integrar no Detail.tsx**
- Quando `employee?.fechamento_manual === true`:
  - Esconder o `KpiEditForm` padrão (KPIs automáticos não se aplicam)
  - Esconder a seção `DynamicIndicatorsSection` (indicadores automáticos não se aplicam)
  - Mostrar o `ManualPayoutForm` no lugar
- O card "Variável" no header passa a mostrar o `payout.valor_variavel_total` direto do banco (sem cálculo local)

### Resultado
Para Yanca (e qualquer futuro colaborador manual): abrir o detalhe → preencher os valores diretamente → salvar → valores persistem sem serem sobrescritos.

