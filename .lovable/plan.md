

# Remover "% Meta Global" do Sistema de Fechamento

## Problema
A "% Meta Global" está exibindo valores incorretos porque é calculada como uma média simples dos percentuais de atingimento, mas isso não reflete corretamente a performance considerando os pesos diferentes de cada indicador.

## Locais de Alteração

### 1. Página Principal de Fechamento (`src/pages/fechamento-sdr/Index.tsx`)
- **Tabela**: Remover coluna "% Meta Global" do cabeçalho e das células
- **CSV Export**: Remover "% Meta Global" dos headers e dados exportados
- **Alertas de performance**: Remover lógica de cores baseada em globalPct (criticalCount, warningCount, row highlighting)
- **Função**: Remover `calculateGlobalPct`

### 2. View do SDR (`src/components/fechamento/SdrFechamentoView.tsx`)
- Remover o primeiro Card que mostra "% Meta Global"
- Remover função `calculateGlobalPct`
- Ajustar grid de 6 para 5 colunas

### 3. View do Closer (`src/components/fechamento/CloserFechamentoView.tsx`)
- Remover o primeiro Card que mostra "% Meta Global"
- Remover função `calculateGlobalPct` e `getColorForPct`
- Ajustar grid de 6 para 5 colunas

### 4. Resumo de Metas da Equipe (`src/components/fechamento/TeamGoalsSummary.tsx`)
- Remover linha "Meta Global: X%" na seção "Melhor SDR" / "Melhor Closer"
- Substituir por outra métrica relevante ou remover completamente

## Detalhes Técnicos

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/fechamento-sdr/Index.tsx` | Remover coluna da tabela, CSV e lógica de alertas |
| `src/components/fechamento/SdrFechamentoView.tsx` | Remover card "% Meta Global" |
| `src/components/fechamento/CloserFechamentoView.tsx` | Remover card "% Meta Global" |
| `src/components/fechamento/TeamGoalsSummary.tsx` | Remover "Meta Global" do display de melhor SDR/Closer |

### Código a Remover/Modificar

**Index.tsx - Remover da tabela:**
```text
// Remover header
<TableHead className="text-right">% Meta Global</TableHead>

// Remover célula
<TableCell className="text-right">
  <span className={...}>{globalPct.toFixed(1)}%</span>
</TableCell>
```

**Index.tsx - Remover do CSV:**
```text
// Remover de headers array:
"% Meta Global"

// Remover de rows map:
globalPct.toFixed(1) + "%"
```

**SdrFechamentoView.tsx e CloserFechamentoView.tsx:**
```text
// Remover Card inteiro de "% Meta Global"
<Card>
  <CardContent className="pt-4 pb-3">
    <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
      <TrendingUp className="h-3.5 w-3.5" />
      % Meta Global
    </div>
    ...
  </CardContent>
</Card>

// Ajustar grid: lg:grid-cols-6 → lg:grid-cols-5
```

## Resultado Esperado
- Interface mais limpa sem métrica incorreta
- CSV exportado sem coluna "% Meta Global"
- Os indicadores individuais (Agendamento, Realizadas, etc.) continuam visíveis com seus valores corretos

