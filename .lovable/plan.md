

## Discrepância: Aprovados 33 vs Selecionados 16

### Causa raiz

Os dois números vêm de **hooks diferentes com lógicas distintas**:

| Métrica | Hook | Lógica |
|---|---|---|
| **Aprovados: 33** (KPI topo) | `useR2CarrinhoKPIs` | Conta **todos** os attendees com status "aprovado" na **janela operacional** (Sex-Sex), independente de terem contrato na safra |
| **Selecionados: 16** (Métricas) | `useR2MetricsData` | Conta apenas aprovados que vieram da **cadeia safra**: contrato pago (Qui-Qua) → contato → primeiro R2 após contrato → status aprovado |

Ou seja, os 33 aprovados incluem leads que foram aprovados no R2 mas cujo contrato **não está na safra atual** (pode ser de semanas anteriores, ou leads sem contrato vinculado). Os 16 selecionados são apenas os que têm contrato **nesta safra** e foram aprovados.

### Solução proposta

**"Selecionados" deveria refletir o mesmo número de "Aprovados" do topo**, pois a seção "Conversão do Carrinho" deve mostrar a conversão dos leads aprovados em vendas de parceria.

**Correção**: No `useR2MetricsData.ts`, o cálculo de `selecionados` (linha 338) deve usar a mesma lógica do KPI de Aprovados — contar attendees aprovados na janela operacional, não apenas os da cadeia safra.

Alternativa mais simples: passar o valor de `aprovados` do `useR2CarrinhoKPIs` para o painel de métricas e usá-lo como `selecionados`, garantindo consistência visual.

### Arquivo afetado
- `src/hooks/useR2MetricsData.ts` — Ajustar cálculo de `selecionados` para usar a mesma janela operacional dos Aprovados do topo
- Ou `src/components/crm/R2MetricsPanel.tsx` — Receber `aprovados` do KPI e usar como override

