

# Corrigir Erro de Ambiguidade na Funcao get_all_hubla_transactions

## Problema

O faturamento de janeiro de 2026 nao aparece porque a chamada RPC retorna erro **HTTP 300** (ambiguidade):

```
Could not choose the best candidate function between:
- get_all_hubla_transactions(...p_start_date => text...)
- get_all_hubla_transactions(...p_start_date => timestamp with time zone...)
```

### Causa Raiz

Existem duas versoes da mesma funcao com tipos de parametros diferentes. Quando o frontend envia uma string ISO ("2026-01-01T00:00:00-03:00"), o PostgreSQL nao consegue decidir qual versao usar.

## Solucao

Remover a versao antiga (com `timestamp with time zone`) e manter apenas a versao com `text`, que e mais recente e inclui a coluna `reference_price`.

### Migracao SQL

```sql
-- Remover a versao antiga da funcao (com timestamp with time zone)
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(
  p_search text,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_limit integer,
  p_products text[]
);
```

### Por que manter a versao TEXT?

1. **Mais recente**: Inclui a coluna `reference_price` usada pelo sistema de pricing
2. **Mais flexivel**: Aceita strings em qualquer formato
3. **Compativel**: O frontend ja envia strings formatadas

## Arquivos Afetados

Nenhuma alteracao de codigo necessaria - apenas a remocao da funcao duplicada no banco.

## Resultado Esperado

Apos a correcao:

1. Chamadas RPC funcionarao sem ambiguidade
2. Faturamento de janeiro de 2026 sera exibido corretamente
3. Dashboard e relatorios voltarao a funcionar normalmente

## Verificacao

Apos aplicar a migracao, o hook `useTeamRevenueByMonth` devera retornar os dados corretamente:

- **Incorporador**: ~R$ 1.3M (com deduplicacao)
- **Transacoes**: 5.498 registros de janeiro/2026

