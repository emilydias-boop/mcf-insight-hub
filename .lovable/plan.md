

## Plano: Remover "Semanas" e simplificar menu do Dashboard

### Alterações

**1. `src/components/layout/AppSidebar.tsx` (linhas 113-121)**

Transformar o item "Dashboard" de menu expansível (com sub-itens) para link direto sem filhos:

```typescript
{
  title: "Visão Diretor",
  url: "/dashboard",
  icon: LayoutDashboard,
  resource: "dashboard",
},
```

Resultado no sidebar:
- Visão Chairman
- Visão Diretor ← clique único, sem expandir

**2. `src/App.tsx` (linha 92 e 183)**

- Remover o import `DashboardSemanas`
- Remover a rota `dashboard/semanas`

**3. Arquivo `src/pages/dashboard/Semanas.tsx`**

- Deletar o arquivo (não será mais usado)

> Os hooks `useWeeklyMetricsList` e `usePendingMetrics` permanecem pois podem ser usados por outros componentes. O componente `WeeklyMetricsDetailDrawer` também permanece caso seja referenciado em outro lugar.

