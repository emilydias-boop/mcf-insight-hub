

## Limpeza e melhorias do Painel Comercial

### Remover (ruído)

| Item | Arquivo |
|------|---------|
| KPI Card "SDRs Ativos" | `TeamKPICards.tsx` — remover do array `cards` |
| Coluna "% Presença" da tabela SDRs | `SdrSummaryTable.tsx` — remover coluna |
| Linha separada "Outside" na tabela Closers | `CloserSummaryTable.tsx` — remover TableRow "Outside" (já tem coluna por closer) |

### Manter
- **KPI Card "Outside"** — fica como está

### Adicionar

| Item | Arquivo | Detalhe |
|------|---------|---------|
| Linha **Total** na tabela SDRs | `SdrSummaryTable.tsx` | Soma de todas as colunas, igual à tabela Closers |
| Botão **Atualizar** | `ReunioesEquipe.tsx` | Ícone RefreshCw ao lado do botão Exportar, chama `refetch()` |
| Timestamp "Atualizado há X min" | `ReunioesEquipe.tsx` | Texto pequeno ao lado dos filtros |
| Coluna Meta como `agendamento/meta` | `SdrSummaryTable.tsx` | Formato `58/72` com cor verde (bateu) / vermelho (não bateu) |
| Filtro contextual por aba | `ReunioesEquipe.tsx` | Dropdown muda para "Todos os Closers" na aba Closers |
| Tooltip melhorado em "Contratos" | `TeamKPICards.tsx` | Explicar que exclui outside |

### Arquivos afetados
- `src/components/sdr/TeamKPICards.tsx`
- `src/components/sdr/SdrSummaryTable.tsx`
- `src/components/sdr/CloserSummaryTable.tsx`
- `src/pages/crm/ReunioesEquipe.tsx`

