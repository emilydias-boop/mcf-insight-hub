

## Problema: Discrepância de valores entre tabela e detalhe do Fechamento

### Diagnóstico

A **tabela do Index** (`/fechamento-sdr`) mostra `payout.valor_variavel_total` e `payout.total_conta` diretos do banco de dados (valores calculados pela Edge Function na última execução).

A **página de Detalhe** (`/fechamento-sdr/:id`) recalcula localmente via `useCalculatedVariavel` com os KPIs e métricas atuais, e mostra esse valor calculado em tempo real. Quando há diferença > R$1, exibe o badge "Recalcular".

No caso da Juliana:
- **Banco (Index)**: Variável R$ 743 / Total R$ 3.543
- **Calculado (Detail)**: Variável R$ 953 / Total R$ 3.753

A diferença de ~R$210 ocorre porque os KPIs mudaram desde o último "Salvar e Recalcular", mas o banco não foi atualizado.

### Solução

Fazer a **tabela do Index também usar o cálculo local** (mesma lógica do Detail), garantindo que ambas as telas mostrem o mesmo valor. Quando houver divergência com o banco, exibir um indicador visual sutil.

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `src/pages/fechamento-sdr/Index.tsx` | Para cada payout na tabela, calcular o variável localmente usando a mesma lógica do `useCalculatedVariavel` e exibir o valor calculado em vez do `payout.valor_variavel_total` |
| 2 | Criar componente auxiliar | `PayoutRowCalculated` - componente que encapsula uma row da tabela e internamente usa `useCalculatedVariavel` + `useActiveMetricsForSdr` para recalcular |
| 3 | Totalizadores | Somar os valores calculados localmente nos cards de Total Fixo/Variável/Conta |

### Abordagem técnica

Criar um componente `PayoutTableRow` que recebe o payout e internamente:
1. Chama `useActiveMetricsForSdr(payout.sdr_id, anoMes)` para obter métricas ativas
2. Chama `useSdrMonthKpi(payout.sdr_id, anoMes)` para KPIs atuais  
3. Chama `useSdrCompPlan(payout.sdr_id, anoMes)` para plano de compensação
4. Usa `useCalculatedVariavel` para calcular o variável real
5. Exibe o valor calculado, com badge sutil se divergir do banco

Para os totalizadores, cada row reporta seu valor calculado via callback, e o pai soma.

### Consideração de performance

Cada row fará 3 queries extras (metrics, kpi, compPlan). Com ~16 payouts, são ~48 queries extras. Mitigações:
- React Query já faz cache/dedup (métricas por squad são compartilhadas)
- `staleTime: 30s` evita refetches desnecessários
- Alternativa mais leve: manter os valores do banco na tabela mas adicionar um **ícone de warning** quando o Detail mostrar divergência (sem queries extras)

### Recomendação

A abordagem mais segura e performática é **manter os valores do banco na tabela** (como está) mas:
1. Adicionar um botão "Recalcular Todos" mais proeminente
2. Na coluna Variável, mostrar um **tooltip/ícone** quando o payout tem status DRAFT indicando que os valores podem estar desatualizados
3. Documentar que os valores na tabela refletem o último cálculo salvo

Isso evita queries N+1 e mantém a tabela rápida, enquanto comunica claramente ao usuário que precisa recalcular.

