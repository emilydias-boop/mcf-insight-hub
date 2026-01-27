

# Plano: Corrigir Conflito de Assinatura de Função RPC

## Problema Identificado

O erro ocorre porque existem **duas versões** da função `get_all_hubla_transactions` no banco:

| Versão | Tipo dos Parâmetros de Data |
|--------|----------------------------|
| Antiga | `text` |
| Nova | `timestamp with time zone` |

Quando o frontend envia uma string como `"2026-01-01T00:00:00-03:00"`, o PostgreSQL não consegue decidir automaticamente qual função chamar, pois a string é compatível com ambos os tipos.

## Causa Raiz

A migration `20260127152906` usou `CREATE OR REPLACE FUNCTION`, que substitui funções **apenas se a assinatura (tipos dos parâmetros) for idêntica**. Como os tipos mudaram de `text` para `timestamptz`, o PostgreSQL criou uma **nova função** em vez de substituir a antiga.

## Solução

Criar uma migration que:
1. **DROP** da função antiga (com assinatura `text`)
2. Manter apenas a versão com `timestamptz`

## Alteração Técnica

### Migration SQL

```sql
-- Remover versão antiga da função com parâmetros text
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(
  text, text, text, integer
);

-- Remover versão antiga da função by_bu com parâmetros text
DROP FUNCTION IF EXISTS public.get_hubla_transactions_by_bu(
  text, text, text, text, integer
);
```

## Por que isso funciona?

- Após remover a versão antiga, só existirá uma função com esse nome
- O PostgreSQL conseguirá fazer a conversão automática de `text` → `timestamptz` quando receber a string do frontend
- Não precisa alterar o código do frontend

## Arquivo a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/[timestamp]_drop_old_function_signatures.sql` | Remove versões antigas das funções |

## Resultado Esperado

Após a correção:
- O erro de "could not choose the best candidate function" será eliminado
- A listagem de transações voltará a funcionar normalmente
- O Robson Moreira aparecerá apenas uma vez (como esperado após a correção anterior)

