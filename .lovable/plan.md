

# Corrigir Contratos MCF sem Tag de Lancamento no "Sem Closer"

## Problema

Existem 18 transacoes em janeiro com produto "A000 - Contrato MCF" ou "Contrato MCF" que nao possuem `sale_origin = 'launch'`. A hierarquia de atribuicao verifica `sale_origin === 'launch'` como primeiro filtro, entao essas 18 transacoes passam direto, nao encontram match na agenda, e caem em "Sem closer".

Dados no banco:
- 73x "A000 - Contrato MCF" com `sale_origin = 'launch'` (OK)
- 17x "A000 - Contrato MCF" com `sale_origin = NULL` (problema)
- 1x "Contrato MCF" com `sale_origin = NULL` (problema)

## Solucao

Duas acoes complementares:

### 1. Corrigir dados existentes (SQL manual)

Executar no Cloud View > Run SQL para corrigir as 18 transacoes:

```sql
UPDATE hubla_transactions
SET sale_origin = 'launch'
WHERE product_name ILIKE '%Contrato MCF%'
  AND sale_origin IS NULL;
```

### 2. Adicionar fallback no codigo

No `CloserRevenueSummaryTable.tsx`, expandir a verificacao de lancamento para tambem capturar transacoes "Contrato MCF" que nao foram tagueadas:

**Arquivo**: `src/components/relatorios/CloserRevenueSummaryTable.tsx`

Alterar a condicao de lancamento (linha 132):

**Antes:**
```typescript
if (tx.sale_origin === 'launch') {
```

**Depois:**
```typescript
if (tx.sale_origin === 'launch' || 
    (tx.product_name && tx.product_name.toLowerCase().includes('contrato mcf'))) {
```

Isso garante que:
- Transacoes ja tagueadas continuam funcionando
- Transacoes futuras de "Contrato MCF" sem tag tambem sao capturadas automaticamente
- O SQL corrige os dados historicos para consistencia

## Resultado Esperado

- As 18 transacoes "Contrato MCF" saem de "Sem closer" e vao para "Lancamento"
- "Sem closer" reduz de 122 para ~104 transacoes
- Faturamento de lancamento aumenta em ~R$ 8.449 (17x R$ 497 + valores adicionais)

