

## Plano: Filtrar sócios (is_partner) do relatório de contratos

### Problema
O relatório de contratos (`useContractReport.ts`) mostra 100 contratos porque **não filtra `is_partner`**. O painel SDR mostra 99 porque exclui participantes com `is_partner = true`. Existe 1 sócio com `contract_paid_at` preenchido que infla o relatório.

### Solução

**Arquivo: `src/hooks/useContractReport.ts`**
- Adicionar `.eq('is_partner', false)` na query, logo após `.not('contract_paid_at', 'is', null)` (linha 98)
- Incluir `is_partner` no select para garantir que o filtro funcione

Resultado: relatório passará de 100 para 99, alinhado com o painel.

