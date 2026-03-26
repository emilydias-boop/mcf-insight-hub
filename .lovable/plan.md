

## Limpeza das páginas individuais SDR/Closer

### 1. Closer Detail — Remover card "Resumo do Período" (redundante)
**Arquivo**: `CloserMeetingsDetailPage.tsx` (linhas 147-181)

O card repete exatamente os mesmos dados dos KPI cards acima (R1 Realizada, Contratos, Taxa Conversão, R2 Agendadas). Deletar o card e deixar o `CloserRankingBlock` ocupando largura total.

### 2. Closer Detail — Adicionar KPI "R2 Agendada"
**Arquivo**: `CloserDetailKPICards.tsx`

Hoje os KPI cards não mostram R2 Agendada (que só aparecia no card redundante). Adicionar como 8º KPI card com ícone Calendar e média do time.

**Nota**: R1 Agendada **não será adicionada** ao ranking do closer — essa métrica é responsabilidade do SDR. O closer só responde a partir do momento em que o lead comparece ou dá no-show.

### 3. SDR Detail — Remover aba "Todos os Negócios"
**Arquivo**: `SdrMeetingsDetailPage.tsx`

Essa aba puxa todos os deals do CRM sem filtro de período — fora do contexto de performance. Remover aba, import de `useSdrDeals` e `SdrDealsTable`. Verificar se esses 2 arquivos ficam órfãos e deletar se sim.

### 4. Painel principal — Renomear "Realizadas" → "R1 Realizada"
**Arquivo**: `TeamKPICards.tsx`

Padronizar nomenclatura com tabelas e páginas individuais.

### Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `CloserMeetingsDetailPage.tsx` | Remover card Resumo, CloserRankingBlock full-width |
| `CloserDetailKPICards.tsx` | Adicionar KPI R2 Agendada |
| `SdrMeetingsDetailPage.tsx` | Remover aba Negócios + imports |
| `TeamKPICards.tsx` | Renomear label |
| `useSdrDeals.ts` | Deletar se órfão |
| `SdrDealsTable.tsx` | Deletar se órfão |

