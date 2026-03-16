

## Plano: Separar Outside em KPI próprio

### Situação atual
O card "Contratos" mostra 108, que é a soma de `contrato_pago` (99) + `outside` (9). O tooltip diferencia, mas visualmente é um único número.

### Alteração

**Arquivo: `src/components/sdr/TeamKPICards.tsx`**
1. No card "Contratos" (linha 71-77): mudar o valor para mostrar apenas contratos sem outside: `(kpis.totalContratos || 0) - (kpis.totalOutside || 0)`
2. Adicionar novo card "Outside" logo após "Contratos", com:
   - Valor: `kpis.totalOutside`
   - Ícone: `LogOut` ou `ExternalLink` (Lucide)
   - Cor: `text-rose-400` / `bg-rose-400/10`
   - Tooltip: "Leads que compraram contrato antes da reunião R1"
3. Ajustar o grid: de `lg:grid-cols-7` para `lg:grid-cols-8` (e de `8` para `9` quando `isToday`)

### Resultado
- Card "Contratos": 99 (apenas contratos da agenda)
- Card "Outside": 9 (vendas pré-reunião)
- Total lógico permanece 108, mas separado visualmente

