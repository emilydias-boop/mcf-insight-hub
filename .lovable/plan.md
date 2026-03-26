

## Remover "Taxa Contato" e "Tempo Médio" dos KPIs — grid 3×2

### Mudanças

**Arquivo 1: `src/hooks/useSdrPerformanceData.ts`**
- Remover o objeto "Taxa Contato" (linhas 265-275)
- Remover o objeto "Tempo Médio" (linhas 280-290)
- Resultado: 6 métricas — Agendamentos, R1 Realizada, Contratos Pagos, Taxa Contrato, Taxa No-Show, Total Ligações

**Arquivo 2: `src/components/sdr/SdrDetailKPICards.tsx`**
- Mudar grid de `lg:grid-cols-5` para `lg:grid-cols-3`
- Layout final: 2 linhas × 3 colunas

### Layout final

```text
Agendamentos  │  R1 Realizada   │  Contratos Pagos
Taxa Contrato │  Taxa No-Show   │  Total Ligações
```

