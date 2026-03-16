

## Análise: Diferença entre 97 (Relatório) e 108 (Painel)

### Investigação no banco de dados

Consultei diretamente o banco e encontrei **99 contratos** no período de março (não 108 e não 97). Detalhamento:

| Status do attendee | Qtd | Contado no Relatório? | Contado no Painel? |
|---|---|---|---|
| `contract_paid` | 93 | Sim | Sim |
| `refunded` | 4 | Sim (após fix anterior) | Sim |
| `sem_sucesso` (com `contract_paid_at`) | 2 | **Não** | Sim |
| **Total** | **99** | **97** | **99** |

### Causa da diferença de 97 vs 99

O relatório de contratos filtra por `status IN ('contract_paid', 'refunded')`, mas existem **2 attendees** com status `sem_sucesso` que possuem `contract_paid_at` preenchido (lead pagou, mas depois o closer marcou como "sem sucesso"). O painel SDR e os closerMetrics usam `contract_paid_at IS NOT NULL` como critério, por isso capturam esses 2.

### Sobre o 108

A RPC `get_sdr_metrics_from_agenda` retorna soma de 99 contratos. O `useR1CloserMetrics` também resulta em 99. O número 108 pode refletir dados de um momento anterior (cache ou dados que mudaram desde o screenshot). Atualmente o banco tem 99.

### Solução

Alinhar o relatório de contratos para usar a mesma lógica do painel — `contract_paid_at IS NOT NULL` em vez de filtrar por status:

**Arquivo: `src/hooks/useContractReport.ts`**
- Linha 98: Substituir `.in('status', ['contract_paid', 'refunded'])` por `.not('contract_paid_at', 'is', null)` e remover o filtro de status
- Isso captura qualquer attendee que teve pagamento registrado, independente do status atual
- Manter `isRefunded: row.status === 'refunded'` para badge visual
- Adicionar `isPartner = false` filter (atualmente ausente no relatório)

Resultado: o relatório passará de 97 para 99, alinhando com a fonte de verdade (`contract_paid_at`).

