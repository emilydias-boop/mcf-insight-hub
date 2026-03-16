

## Plano: Incluir contratos reembolsados no relatório

### O que é "refunded"

O status `refunded` indica que o contrato **foi pago** pelo cliente, mas depois houve **solicitação de reembolso**. Para fins de performance comercial, ele conta como venda realizada — o closer vendeu, o SDR agendou. Por isso o painel SDR (108) inclui ambos e é o número correto.

### Problema

O relatório de contratos (`useContractReport.ts` linha 97) filtra apenas `status = 'contract_paid'`, excluindo os `refunded`. Isso causa a diferença de 108 vs 93.

### Solução

**Arquivo: `src/hooks/useContractReport.ts`**
- Alterar `.eq('status', 'contract_paid')` para `.in('status', ['contract_paid', 'refunded'])`
- Adicionar campo `isRefunded: boolean` ao `ContractReportRow` para que o relatório possa diferenciar visualmente (ex: badge "Reembolsado")
- No mapeamento dos dados, incluir `isRefunded: row.status === 'refunded'`

**Arquivo: componente de tabela do relatório** (se houver coluna de status)
- Mostrar badge/indicador quando `isRefunded = true` para manter a transparência

Resultado: o relatório passará a mostrar 108 contratos, alinhado com o painel SDR.

