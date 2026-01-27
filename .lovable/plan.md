
# Plano: Adicionar hubla_id ao Retorno da Função RPC

## Problema Identificado

A função RPC `get_all_hubla_transactions` **não retorna o campo `hubla_id`**, que é essencial para o agrupamento de transações por compra funcionar.

### Diagnóstico

| Componente | Status |
|------------|--------|
| Interface TypeScript (`HublaTransaction`) | Declara `hubla_id` |
| Componente de agrupamento (`TransactionGroupRow`) | Usa `tx.hubla_id` para agrupar |
| Função RPC no banco | **NÃO retorna** `hubla_id` |

**Resultado**: O `hubla_id` chega como `undefined` no frontend. A função `groupTransactionsByPurchase` usa `tx.id` como fallback, criando um grupo por transação ao invés de consolidar.

## Solução

Atualizar a função RPC para incluir `hubla_id` no retorno.

## Alteração Técnica

### Migration SQL

A função precisa ser recriada com:
1. `hubla_id text` adicionado ao `RETURNS TABLE`
2. `ht.hubla_id` adicionado ao `SELECT`

```sql
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(...)
RETURNS TABLE(
  id uuid,
  hubla_id text,  -- ADICIONAR
  product_name text,
  ...
)
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.hubla_id,  -- ADICIONAR
    ht.product_name,
    ...
END;
$$;
```

A mesma alteração será feita em `get_hubla_transactions_by_bu`.

## Resultado Esperado

Após a correção:

| Antes | Depois |
|-------|--------|
| 3 linhas separadas (3 grupos) | 1 linha consolidada + 2 order bumps |
| hubla_id = undefined | hubla_id = "8f7973cb-..." ou "...-offer-1" |
| Agrupamento não funciona | Agrupamento funciona corretamente |

### Visualização Esperada para ADAN Lucas

```text
▼ ACESSO VITALÍCIO + 2 bumps (R$ 163,40 bruto | R$ 163,40 líquido)
   ├─ ACESSO VITALÍCIO (Principal) - R$ 81,70
   ├─ ACESSO VITALÍCIO (Bump) - R$ 44,78  
   └─ A010 - Consultoria... (Bump) - R$ 36,92
```

## Arquivo a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/[timestamp]_add_hubla_id_to_rpc.sql` | Adiciona hubla_id ao retorno das funções RPC |
