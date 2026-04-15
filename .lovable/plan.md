

## Plano: KPIs clicáveis com filtro na tabela

### Comportamento
- Clicar em um KPI filtra a tabela para mostrar apenas os registros daquela categoria
- Clicar novamente no mesmo KPI remove o filtro (toggle)
- O KPI ativo fica visualmente destacado (borda/fundo mais forte)
- Cada KPI mostra sub-contadores inline para dar contexto rápido

### Mapeamento de filtros

| KPI clicado | Situações filtradas | Sub-info exibida no card |
|---|---|---|
| **Total Pagos** | Todas (sem filtro) | — |
| **Agendados** | `agendado`, `proxima_semana`, `pre_agendado`, `realizada` | Aprovados / Pré-agend / Próx. Semana / Realizadas |
| **Pendentes** | `pendente` | Recentes (≤3d) / Antigos (>3d) |
| **No-show** | `no_show` | — |
| **Reembolso** | `reembolso` | — |

### Alterações em `src/components/crm/R2ContractLifecyclePanel.tsx`

1. **Novo estado**: `activeKpiFilter: string | null` (toggle)
2. **Expandir KPIs computed**: adicionar sub-contadores (aprovados, pré-agendados, próxima semana, realizadas dentro de agendados; recentes/antigos dentro de pendentes)
3. **Filtrar `filteredRows`**: aplicar `activeKpiFilter` antes do search
4. **Estilizar cards**: `cursor-pointer`, borda highlight quando ativo, sub-texto com breakdown
5. **Extrair KPI cards para componente inline** com `onClick` e `isActive` prop

### Seção técnica

```ts
// Estado
const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);

// Sub-KPIs
const agendadosSub = {
  aprovados: rows.filter(r => r.situacao === 'agendado').length,
  preAgendados: rows.filter(r => r.situacao === 'pre_agendado').length,
  proximaSemana: rows.filter(r => r.situacao === 'proxima_semana').length,
  realizadas: rows.filter(r => r.situacao === 'realizada').length,
};
const pendentesSub = {
  recentes: rows.filter(r => r.situacao === 'pendente' && (r.diasParado ?? 0) <= 3).length,
  antigos: rows.filter(r => r.situacao === 'pendente' && (r.diasParado ?? 0) > 3).length,
};

// Filtro aplicado
const FILTER_MAP: Record<string, ContractSituacao[]> = {
  agendados: ['agendado', 'proxima_semana', 'pre_agendado', 'realizada'],
  pendentes: ['pendente'],
  noShow: ['no_show'],
  reembolso: ['reembolso'],
};

// Na filtragem
let displayed = rows;
if (activeKpiFilter && FILTER_MAP[activeKpiFilter]) {
  displayed = displayed.filter(r => FILTER_MAP[activeKpiFilter].includes(r.situacao));
}
// depois aplica searchTerm
```

Cada card KPI terá `onClick={() => setActiveKpiFilter(k === activeKpiFilter ? null : k)}` e uma classe `ring-2` quando ativo. Sub-contadores aparecem como texto `text-[10px]` abaixo do número principal.

