

## Remover KPIs da Visão Geral do CRM

### O que muda

Remover a linha de KPI cards (Entraram, Trabalhados, Avançados, Perdidos, Sem Movimentação, Esquecidos, Sem Owner) do `FunilDashboard`. Todo o restante (Saúde da Pipeline, Funil, Rankings, Alertas) permanece igual.

### Alteração

**`src/components/crm/FunilDashboard.tsx`** — Remover a linha 92 (`<OverviewKPIs ... />`) e o import de `OverviewKPIs` na linha 7. Nenhum outro arquivo é alterado.

