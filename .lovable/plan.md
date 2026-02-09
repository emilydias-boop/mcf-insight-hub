
# Corrigir Faturamento do Incorporador (R$ 1.83M para ~R$ 2.04M)

## Problema

O faturamento de janeiro/2026 mostra R$ 1.832.598, mas deveria estar proximo de R$ 2.038.000. Duas causas identificadas:

| Causa | Impacto Estimado |
|-------|-----------------|
| RPC `get_all_hubla_transactions` exclui `source = 'make'` | ~R$ 170-200k em vendas Make/Asaas nao contabilizadas |
| Hook `useTeamRevenueByMonth` nao passa `reference_price` ao calculo | Diferenca menor no calculo de bruto |

### Evidencia no Banco

| Metrica | Valor |
|---------|-------|
| Bruto atual (com dedup + reference_price, sem Make) | R$ 1.846.398 |
| Bruto atual (com dedup, sem reference_price) | R$ 1.315.332 |
| Transacoes Make em Jan/26 (incorporador, 1a parcela) | 29 transacoes |
| Dessas, unicas (sem duplicata Hubla) | ~11 transacoes |

O gap de ~R$ 200k vem das transacoes Make que sao a unica fonte para determinados clientes.

## Solucao

### Passo 1: Migrar RPC `get_all_hubla_transactions` para incluir `source = 'make'`

Atualizar o filtro de source na RPC:

```sql
-- De:
AND ht.source IN ('hubla', 'manual')

-- Para:
AND ht.source IN ('hubla', 'manual', 'make')
AND NOT (ht.source = 'make' AND LOWER(ht.product_name) IN ('contrato', 'ob construir para alugar'))
```

Isso alinha com a RPC `get_first_transaction_ids` que ja inclui `source = 'make'`.

### Passo 2: Corrigir hook `useTeamRevenueByMonth`

O hook atual nao passa `reference_price` ao `getDeduplicatedGross`:

```typescript
// ANTES (linha 45-50):
const transaction = {
  product_name: t.product_name,
  product_price: t.product_price,
  installment_number: t.installment_number,
  gross_override: t.gross_override,
};

// DEPOIS:
const transaction = {
  product_name: t.product_name,
  product_price: t.product_price,
  installment_number: t.installment_number,
  gross_override: t.gross_override,
  reference_price: t.reference_price,  // ADICIONADO
};
```

### Passo 3: Mapear produto "Parceria" para BU Incorporador

```sql
UPDATE product_configurations
SET target_bu = 'incorporador'
WHERE LOWER(product_name) = 'parceria';
```

Isso garante que transacoes "Parceria" entrem no calculo do Incorporador (atualmente `target_bu = NULL`).

## Arquivos a Modificar

| Local | Mudanca |
|-------|---------|
| Banco: RPC `get_all_hubla_transactions` | Adicionar `'make'` ao filtro source |
| Banco: `product_configurations` | Mapear Parceria para incorporador |
| `src/hooks/useTeamRevenueByMonth.ts` | Adicionar `reference_price` ao objeto de transacao (linha 50) |

## Resultado Esperado

O faturamento bruto de janeiro/2026 deve subir de R$ 1.832.598 para aproximadamente R$ 2.038.000, incluindo:
- Transacoes via Make/Asaas que sao unicas (sem duplicata Hubla)
- Calculo correto usando `reference_price` da tabela de configuracoes
- Parceria corretamente atribuida ao Incorporador
