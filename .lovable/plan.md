

# Corrigir Faturamento R$ 0,00 - Erro de Ambiguidade RPC

## Problema

O faturamento de janeiro de 2026 mostra **R$ 0,00** porque a chamada RPC `get_all_hubla_transactions` retorna erro **HTTP 300** (ambiguidade de funcao).

### Mensagem de Erro

```
PGRST203: Could not choose the best candidate function between:
- get_all_hubla_transactions(...p_start_date => text...)
- get_all_hubla_transactions(...p_start_date => timestamp with time zone...)
```

### Causa Raiz

Existem duas versoes da mesma funcao no banco de dados:

| Versao | Tipo dos Parametros | Status |
|--------|---------------------|--------|
| Antiga | `timestamp with time zone` | Obsoleta |
| Nova | `text` | Correta (inclui `reference_price`) |

Quando o frontend envia strings ISO (ex: `"2026-01-01T00:00:00-03:00"`), o PostgreSQL nao consegue decidir qual versao usar.

## Solucao

Criar uma migracao SQL para remover a versao antiga da funcao.

### SQL da Migracao

```sql
-- Remover a versao antiga da funcao (com timestamp with time zone)
-- Manter apenas a versao com TEXT que e mais recente e completa
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
2. **Mais flexivel**: Aceita strings em qualquer formato de data
3. **Compativel**: O frontend ja envia strings formatadas com timezone

## Impacto

Apos a correcao:

| Antes | Depois |
|-------|--------|
| Faturamento: R$ 0,00 | Faturamento: ~R$ 1.3M |
| Erro HTTP 300 | Sucesso |
| Dashboard quebrado | Dashboard funcionando |

## Arquivos Afetados

Nenhuma alteracao de codigo frontend necessaria - apenas a remocao da funcao duplicada no banco de dados via migracao SQL.

## Verificacao Pos-Correcao

Apos aplicar a migracao:

1. O hook `useTeamRevenueByMonth` retornara os dados corretamente
2. O card "Metas do Time" exibira o faturamento real (~R$ 1.3M para janeiro/2026)
3. Todos os relatorios que usam essa RPC voltarao a funcionar

