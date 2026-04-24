

## Padronizar KPIs da página Reuniões Equipe com base SDR

### Objetivo
Eliminar a divergência entre os cards de KPI (mostrando 30,0% de Taxa No-Show) e a tabela de dados (mostrando 24,7%) na página `/crm/reunioes-equipe`, alinhando tudo à base do SDR (que também é usada no Funil e no Dashboard Comercial).

### Causa raiz
- **Cards** usam `useR1CloserMetrics`, que filtra apenas closers ativos da BU → base ~663 reuniões.
- **Tabela e Funil** usam `useSdrMetricsFromAgenda`, que conta todo o esforço de agendamento dos SDRs, independentemente de o closer atual estar ativo → base ~806 reuniões.
- A diferença (~157 reuniões) corresponde a agendamentos atribuídos a closers que foram desativados ou trocaram de BU depois.

### Mudança proposta
Arquivo único: `src/pages/crm/ReunioesEquipe.tsx`

No bloco `enrichedKPIs`, trocar a fonte das métricas operacionais:

| Métrica | Antes (Closer) | Depois (SDR) |
|---|---|---|
| `totalR1Agendada` | `r1FromClosers.r1Agendada` | `teamKPIs.totalR1Agendada` |
| `totalRealizadas` | `r1FromClosers.r1Realizada` | `teamKPIs.totalRealizadas` |
| `totalNoShows` | `r1FromClosers.noShows` | `teamKPIs.totalNoShows` |
| `taxaNoShow` | calculada sobre base do closer | `(totalNoShows / totalR1Agendada) * 100` sobre base SDR |

Métricas financeiras (contratos, faturamento) permanecem inalteradas — continuam vindo da fonte do closer, que é a verdade contábil.

### Resultado esperado (Abril/26, BU Incorporador)
- **R1 Agendada:** 663 → **806**
- **Taxa No-Show:** 30,0% → **24,7%**
- Cards, tabela, Funil e Dashboard Comercial passam a mostrar exatamente os mesmos números.

### Escopo
- Apenas o componente `ReunioesEquipe.tsx` é alterado.
- Nenhuma RPC, hook ou tabela do banco é modificada.
- Sem impacto em outras páginas.

