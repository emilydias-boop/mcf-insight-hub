

## Problema: Divergência entre Variável na lista e no detalhe

### Causa raiz
Existem **duas fontes de cálculo independentes** para o valor variável:

1. **Lista (Index.tsx)**: lê `payout.valor_variavel_total` e `payout.total_conta` diretamente do banco (valores salvos pela Edge Function `recalculate`)
2. **Detalhe (Detail.tsx)**: **recalcula localmente** usando o hook `useCalculatedVariavel`, ignorando os valores do banco

O hook `useCalculatedVariavel` usa lógica diferente (ex: cálculo de meta de realizadas como 70% das agendadas reais, fontes de dados diferentes para KPIs de Closer) — produzindo R$ 1.564,50 em vez dos R$ 2.992,50 do banco.

### Correção: unificar a fonte de verdade

O banco (preenchido por `useSdrFechamento.recalculate`) deve ser a **única fonte de verdade**. O Detail.tsx deve exibir os valores do banco, não recalcular localmente.

### Etapa 1: Detail.tsx — usar valores do banco nos cards de resumo
- Card "Variável": trocar `calculatedVariavel.total` → `payout.valor_variavel_total || 0`
- Card "Total Conta": trocar `effectiveFixo + calculatedVariavel.total` → `payout.total_conta || 0`
- Manter `useCalculatedVariavel` e `DynamicIndicatorsGrid` apenas para a seção de indicadores visuais (cards de performance individuais), que servem como preview/conferência

### Etapa 2: Adicionar indicador de divergência
- Se `calculatedVariavel.total` diferir de `payout.valor_variavel_total` por mais de R$ 1, mostrar um badge de alerta discreto sugerindo "Recalcular" — pois indica que os KPIs mudaram desde o último salvamento

Alteração em 1 arquivo: `src/pages/fechamento-sdr/Detail.tsx`

