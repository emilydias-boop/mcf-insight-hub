

## Plano: KPIs pai/filho reorganizados

### Nova hierarquia de KPIs

```text
Total Pagos (limpa filtro)

Realizadas (situacao = 'realizada' | 'agendado' | 'proxima_semana')
  └─ Filhos dinâmicos por r2StatusName: Aprovado, Próx. Semana, Reprovado, Sem status...
     Cada filho filtra a tabela por aquele r2StatusName

Pré-agendado (situacao = 'pre_agendado')
  └─ Sem filhos — filtra direto

Pendentes (situacao = 'pendente')
  └─ Recentes (≤3 dias) | Antigos (>3 dias)

No-show (situacao = 'no_show')
  └─ Sem filhos — filtra direto

Reembolso (situacao = 'reembolso')
  └─ Sem filhos — filtra direto
```

### Comportamento
- Clicar em pai **com filhos** (Realizadas, Pendentes): expande grid de filhos abaixo + filtra tabela pelo grupo pai
- Clicar em filho: filtra tabela pelo subset específico
- Clicar em pai **sem filhos** (Pré-agendado, No-show, Reembolso): filtra tabela direto
- Clicar novamente no mesmo KPI: deseleciona (toggle)
- KPI ativo: `ring-2` com cor correspondente
- Filhos aparecem com animação `transition-all` + `overflow-hidden`

### Alterações em `R2ContractLifecyclePanel.tsx`

1. **Estado**: substituir `activeKpiFilter` por `expandedKpi` (qual pai aberto) + `activeSubFilter` (qual filho selecionado)
2. **Remover KPI "Agendados"**: substituir por "Realizadas" que agrupa `realizada`, `agendado`, `proxima_semana`
3. **Sub-KPIs de Realizadas**: `useMemo` agrupa por `r2StatusName`, gera cards filhos dinamicamente
4. **Sub-KPIs de Pendentes**: Recentes (≤3d) e Antigos (>3d)
5. **Filtragem**: combinar `expandedKpi` + `activeSubFilter` no `filteredRows`
6. **Renderizar filhos**: grid condicional abaixo dos pais com `max-h-0 → max-h-[200px]` transition

### Seção técnica

```ts
const [expandedKpi, setExpandedKpi] = useState<string | null>(null);
const [activeSubFilter, setActiveSubFilter] = useState<string | null>(null);

// Realizadas children — dinâmico por r2StatusName
const realizadasByStatus = useMemo(() => {
  const map = new Map<string, { count: number; color: string | null }>();
  rows.filter(r => ['realizada','agendado','proxima_semana'].includes(r.situacao))
    .forEach(r => {
      const key = r.r2StatusName || 'Sem status';
      const existing = map.get(key) || { count: 0, color: r.r2StatusColor };
      map.set(key, { count: existing.count + 1, color: existing.color });
    });
  return Array.from(map.entries());
}, [rows]);

// Filtro na tabela
let displayed = rows;
if (expandedKpi) {
  displayed = displayed.filter(r => PARENT_FILTER[expandedKpi]?.includes(r.situacao));
  if (activeSubFilter) {
    // Para realizadas: filtra por r2StatusName
    // Para pendentes: filtra por diasParado
  }
}
```

