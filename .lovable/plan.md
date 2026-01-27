
# Plano: Filtrar Transações por Fonte (Apenas Hubla e Manual)

## Problema Identificado

A função RPC `get_all_hubla_transactions` está retornando transações de **todas as fontes**, mas a tela "Vendas MCF Incorporador" deveria mostrar apenas:
- `hubla` (21.814 transações)
- `manual` (17 transações)

Fontes que estão aparecendo indevidamente:
- `hubla_make_sync` (1.181) - são duplicatas sincronizadas do Make
- `make` (490) - transações do Make
- `kiwify` (20)
- `audit_correction` (3)
- `manual_fix` (2)

## Solução

Adicionar filtro de fonte (`source`) na função RPC para incluir apenas `hubla` e `manual`.

## Alteração Necessária

### Migration SQL

Recriar a função `get_all_hubla_transactions` adicionando a condição:

```sql
AND ht.source IN ('hubla', 'manual')
```

A função completa ficará:

```sql
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(...)
...
WHERE pc.target_bu = 'incorporador'
  AND ht.sale_status IN ('completed', 'refunded')
  AND ht.source IN ('hubla', 'manual')  -- NOVO FILTRO
  AND (p_search IS NULL OR ...)
...
```

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| Nova migration SQL | Criar | Adicionar filtro de fonte na função RPC |

## Resultado Esperado

Após a correção:
1. A lista mostrará apenas transações de fonte `hubla` e `manual`
2. Total de transações: ~21.831 (ao invés de ~23.527)
3. Transações `hubla_make_sync` e `make` não aparecerão mais

## Observação Técnica

A função `get_hubla_transactions_by_bu` (usada em outras BUs como Consórcio, Crédito) também será atualizada para manter consistência, mas com filtro mais amplo (`hubla`, `manual`, `kiwify`) para suportar vendas de outras plataformas quando aplicável.
