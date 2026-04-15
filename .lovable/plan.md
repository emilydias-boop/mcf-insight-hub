

## Plano: Corrigir "Total Pagos" — separar leads pagos dos não-pagos

### Problema
O "Total Pagos" subiu de 70 para 78 porque os Steps 1c/1d adicionam leads com R2 Aprovado e Encaixados que **não pagaram contrato** ao mesmo array. O KPI conta `rows.length` (todas as rows), então inclui leads sem pagamento.

O correto seria:
- **Total Pagos = 62** (somente os que vieram da `hubla_transactions` — Step 1a)
- Os leads dos Steps 1c/1d aparecem no relatório mas **não contam** como "pagos"

### Correção

**Arquivo: `src/hooks/useContractLifecycleReport.ts`**

Adicionar uma flag `_isPaidFromHubla: boolean` em cada row:
- Step 1a (Hubla transactions): `_isPaidFromHubla = true`
- Steps 1c/1d (R2 Aprovado + Encaixados sem pagamento): `_isPaidFromHubla = false`

Expor essa flag no `ContractLifecycleRow` como `isPaidContract: boolean`.

**Arquivo: `src/components/crm/R2ContractLifecyclePanel.tsx`**

Mudar o KPI "Total Pagos" de `rows.length` para `rows.filter(r => r.isPaidContract).length`.

### Resultado esperado
- Total Pagos = 62 (alinhado com Carrinho)
- Leads dos Steps 1c/1d continuam visíveis na tabela mas não inflam o KPI
- Todos os outros KPIs (Realizadas, No-show, etc.) continuam contando todas as rows normalmente

### Seção técnica
- `useContractLifecycleReport.ts`: adicionar `_isPaidFromHubla` nas rows do Step 1a (`true`) e Steps 1c/1d (`false`), mapear para `isPaidContract` na interface
- `R2ContractLifecyclePanel.tsx`: `kpis.total = rows.filter(r => r.isPaidContract).length`
- ~10 linhas alteradas no total

