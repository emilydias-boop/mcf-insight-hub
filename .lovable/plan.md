

## Problema: KPIs de Contratos no Painel estão inflados

### Diagnóstico

Duas fontes de dados diferentes estão sendo usadas no Painel "Reuniões de Equipe":

| Componente | Fonte | Problema |
|---|---|---|
| **KPI Cards** (topo) | RPC `get_sdr_metrics_from_agenda` | Conta TODOS os `contract_paid_at` incluindo outsides. Depois o código soma outsides NOVAMENTE em cima |
| **Tabela Closers** | `useR1CloserMetrics` | Correto: deduplica, exclui outsides do `contrato_pago` e conta outsides separadamente |

**Resultado**: O card "Contratos" mostra um número inflado (ex: 193 + 9 = 202 para Fev) enquanto a tabela de Closers mostra o correto (67 + 9 = 76).

Problemas específicos:
1. **Double-counting de Outside**: `TeamKPICards.tsx` linha 72 soma `totalContratos` (que já inclui outsides da RPC) + `totalOutside` (outsides contados novamente)
2. **RPC não deduplica**: Se um lead tem múltiplos attendees (reagendamentos) com `contract_paid_at`, cada um é contado

### Solução

Usar `closerMetrics` (de `useR1CloserMetrics`) como fonte única de verdade para os KPIs de contrato, consistente com a tabela de Closers. Isso já é a recomendação do sistema (ver memória `unified-outside-metrics-source-of-truth`).

### Mudanças

**1. `src/pages/crm/ReunioesEquipe.tsx`**
- Calcular `totalContratos` e `totalOutside` a partir de `closerMetrics` (soma de `contrato_pago` e `outside` por closer)
- Remover a dependência do `teamKPIs.totalContratos` para contratos
- Ajustar `enrichedKPIs` para usar os valores corretos
- Corrigir `dayValues`, `weekValues`, `monthValues` para não duplicar outsides
- Corrigir `totalContratosFromKPI` na linha 601 (também duplicava)

**2. `src/components/sdr/TeamKPICards.tsx`**
- Remover a soma dupla: `value: kpis.totalContratos` (sem somar `totalOutside` novamente, pois o valor já virá correto do parent)
- Manter tooltip mostrando breakdown: `Contratos: X | Outside: Y`

**3. `src/hooks/useTeamMeetingsData.ts`** (opcional)
- Ajustar `taxaConversao` para usar o `totalContratos` correto (sem outsides na base de cálculo)

### Resultado esperado
- Card "Contratos" mostrará o mesmo total que a soma da tabela de Closers
- Tooltip continuará mostrando breakdown (contratos via reunião vs outside)
- Taxa de conversão será calculada corretamente

