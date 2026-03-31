

## Trocar Gráfico de Evolução Diária do Closer para Barras Diárias

### O que muda

O gráfico "Evolução Diária" na página do Closer atualmente mostra linhas acumuladas (Acumulado vs Meta Acumulada). O usuário quer ver **contratos vendidos por dia** em formato de barras, com uma linha de referência para a meta diária (4 contratos).

### Solução

Criar um componente `CloserDailyChart` específico que:
- Usa `BarChart` (recharts) em vez de `LineChart`
- Plota `contratos` (valor diário) como barras verdes
- Desenha uma `ReferenceLine` horizontal em y=4 (meta diária) vermelha tracejada
- Filtra apenas dias úteis (ou dias com contratos > 0) para não poluir o gráfico
- Título: "Contratos Diários"

### Arquivos

1. **Criar `src/components/closer/CloserDailyChart.tsx`** — Componente de barras diárias com `CloserDailyRow[]`, mostrando contratos/dia + ReferenceLine da meta (4)
2. **Editar `src/pages/crm/CloserMeetingsDetailPage.tsx`** — Substituir `<SdrCumulativeChart>` por `<CloserDailyChart>`

### Detalhes técnicos

O `CloserDailyRow` já tem o campo `contratos` (contratos pagos naquele dia) e `metaDiaria` (4 em dias úteis, 0 em fins de semana). O novo componente simplesmente plota esses valores como barras.

