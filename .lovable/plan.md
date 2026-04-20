

## Substituir o "Funil Real do Período" pelo `BUFunnelComplete`

### O que está acontecendo

A tela `/crm` (Visão Geral) ainda renderiza o componente antigo `FlowFunnelBlock` — aquele "Funil Real do Período" com as barras horizontais (Entraram 21, Trabalhados 19, Qualificados 0, R1 Agendadas 47…).

O componente novo (`BUFunnelComplete`) com canais, A010/ANAMNESE, drill-down e tudo mais foi colocado **somente** em `/crm/movimentacoes`. Por isso, ao olhar a Visão Geral, você não vê nenhuma mudança.

### Mudança

**Arquivo único: `src/components/crm/FunilDashboard.tsx`**

1. Remover import de `FlowFunnelBlock`.
2. Adicionar import de `BUFunnelComplete`.
3. Substituir a linha 96:
   ```
   <FlowFunnelBlock data={data?.funnel} isLoading={isLoading} />
   ```
   por:
   ```
   <BUFunnelComplete
     startDate={periodStart}
     endDate={periodEnd}
     originIds={originIds}
     periodLabel={periodLabel}
   />
   ```

**Limpeza (opcional, mesmo arquivo/2 outros):**
- Apagar `src/components/crm/overview/FlowFunnelBlock.tsx` (não será mais usado).
- Remover bloco `funnel` de `useCRMOverviewData.ts` (queries que ficam órfãs).

### Resultado

A `/crm` (Visão Geral) passa a mostrar o mesmo funil completo da `/crm/movimentacoes`: Universo → Qualificados → Sem Interesse → R1 → R2 → Vendas Finais, com tabs por canal (A010 / ANAMNESE / Total), tooltips de fórmula e modo comparativo — respeitando o seletor de período (Hoje / Semana / Mês) que já existe no topo.

### Escopo

- 1 arquivo modificado (`FunilDashboard.tsx`) — ~5 linhas
- 1 arquivo deletado (`FlowFunnelBlock.tsx`) — limpeza
- 1 arquivo limpo (`useCRMOverviewData.ts`) — remove queries órfãs do funnel antigo
- 0 migration

