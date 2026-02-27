

## Análise da Diferença: 208 vs 206

### Origem dos Números

| Fonte | Valor | Como calcula |
|-------|-------|-------------|
| KPI "Contratos" | **208** | `totalContratos (SDR: 185) + outsideFromClosers (23)` |
| Metas "Contrato Pago" | **208** | `monthKPIs.totalContratos (185) + outsideFromClosers (23)` |
| Tabela Closers "Total" | **206** | `soma contrato_pago dos closers (183) + outside (23)` |

### Causa Raiz

A diferença de **2** está entre o `totalContratos` dos SDRs (185) e a soma de `contrato_pago` dos Closers (183). São **hooks diferentes com lógicas distintas**:

1. **SDR** (`get_sdr_metrics_from_agenda` RPC): conta contratos pelo **SDR que agendou** (`booked_by`)
2. **Closer** (`useR1CloserMetrics`): conta contratos pelo **Closer que atendeu** (`closer_id`)

Os 2 contratos "extras" no SDR provavelmente são:
- Reuniões onde o `closer_id` não é de um closer ativo, ou
- Contratos atribuídos a um SDR válido mas cujo closer não está na lista de closers R1 ativos

### Solução

Para que a tabela de Closers bata com o KPI, a linha **Total** deve usar o `totalContratos` do KPI (fonte SDR) em vez de somar `contrato_pago` dos closers.

**`src/components/sdr/CloserSummaryTable.tsx`**:
- Adicionar prop opcional `totalContratosFromKPI?: number`
- Na linha Total, coluna "Contrato Pago": usar `totalContratosFromKPI` quando disponível, senão `totals.contrato_pago + totals.outside`

**`src/pages/crm/ReunioesEquipe.tsx`**:
- Passar `totalContratosFromKPI={enrichedKPIs.totalContratos + outsideFromClosers}` para o `CloserSummaryTable`

Assim o Total da tabela sempre espelha o KPI.

