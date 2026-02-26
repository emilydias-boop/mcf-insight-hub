
Objetivo: eliminar a diferença de R$ 30 entre a visão individual (R$ 630) e a lista (R$ 600) após “Salvar e Recalcular”.

1) Alinhar a fonte de comp plan no frontend com o backend
- Arquivo: `src/hooks/useSdrFechamento.ts` (`useSdrCompPlan`)
- Ajustar o filtro de status do plano vigente para não depender de `status = 'approved'` (minúsculo), que hoje retorna `null` para planos como `PENDING`.
- Usar o mesmo critério prático da lista/backend (ex.: excluir apenas rejeitados), mantendo a seleção do plano mais recente vigente no mês.

2) Corrigir o cálculo local do card “Variável” para seguir a mesma prioridade do recálculo
- Arquivo: `src/hooks/useCalculatedVariavel.ts`
- Para métricas padrão (`agendamentos`, `realizadas`, `tentativas`, `organizacao`):
  - Priorizar `compPlanValueField` (valor específico do plano) antes de cálculo por peso.
  - Usar cálculo por peso apenas como fallback quando o valor específico estiver zerado/ausente.
- Para `agendamentos`, usar meta ajustada com prioridade igual ao card dinâmico/backend:
  - `payout.meta_agendadas_ajustada` → `compPlan.meta_reunioes_agendadas` → `sdrMetaDiaria * diasUteisMes`.

3) Garantir consistência entre componentes
- Validar que `useCalculatedVariavel` e `DynamicIndicatorCard` aplicam exatamente a mesma regra de base/meta para não gerar divergência no mesmo detalhe.
- (Opcional recomendado) extrair helper compartilhado de cálculo para evitar drift futuro entre hook e card.

4) Validação funcional pós-ajuste (caso Juliana)
- Reabrir `Juliana Rodrigues` em `2026-02`.
- Confirmar no detalhe:
  - Base agendadas = 400
  - Base realizadas = 400
  - Variável = R$ 600,00
  - Badge “Recalcular” some após salvar/recalcular.
- Confirmar que a lista permanece com R$ 600,00 (paridade detalhe x lista).

Detalhes técnicos (resumo)
- Divergência atual confirmada:
  - `sdr_month_payout` salvo: `valor_reunioes_agendadas=200`, `valor_reunioes_realizadas=400`, `valor_variavel_total=600`.
  - Detalhe local: estava usando peso 35/35/15/15 sobre R$ 1200 (420/420/180/180), gerando R$ 630.
- Causa combinada:
  - `useSdrCompPlan` não carrega o plano vigente (filtro de status incompatível).
  - `useCalculatedVariavel` prioriza peso em vez de valor específico do plano.
