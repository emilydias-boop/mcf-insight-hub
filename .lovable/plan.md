
## O que está acontecendo (causa raiz)

O erro:

`Could not choose the best candidate function between: public.get_all_hubla_transactions(... p_start_date => text ...), public.get_all_hubla_transactions(... p_start_date => timestamptz ...)`

significa que hoje existem **duas funções diferentes com o mesmo nome** no Postgres:

- `get_all_hubla_transactions(p_search text, p_start_date text, p_end_date text, p_limit int)`
- `get_all_hubla_transactions(p_search text, p_start_date timestamptz, p_end_date timestamptz, p_limit int)`

Como o frontend está chamando `supabase.rpc('get_all_hubla_transactions', { p_start_date: "2026-01-01T00:00:00-03:00", ... })`, o Postgres não consegue decidir automaticamente qual assinatura usar (ambiguidade).

Isso aconteceu porque uma migration anterior criou a versão com `timestamptz`, e depois outra migration recriou a versão com `text`, mas **não removeu** a versão antiga com `timestamptz`.

## Objetivo da correção

1) Manter somente **uma** assinatura (para acabar com a ambiguidade).
2) Manter o comportamento correto:
   - **Somente sources**: `hubla` e `manual`
   - **Somente status**: `completed` e `refunded`
   - Filtrar por BU via `product_configurations.target_bu`
3) Preservar o retorno com `hubla_id` (para o agrupamento no frontend).

## Decisão técnica (mais segura com seu frontend atual)

Padronizar para **assinatura com `text` nas datas** (porque o frontend já manda string com timezone `-03:00`) e **dropar a assinatura `timestamptz`**.

Isso evita ter que mudar vários hooks/formatadores de data.

## Passos de implementação (DB)

### 1) Criar uma migration corretiva que:
- Remova as funções antigas com assinatura `timestamptz`:
  - `DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamptz, timestamptz, integer);`
  - `DROP FUNCTION IF EXISTS public.get_hubla_transactions_by_bu(text, text, timestamptz, timestamptz, integer);`

- Garanta que a versão “final” desejada exista (assinatura `text`) e continue com os filtros:
  - `ht.source IN ('hubla', 'manual')`
  - `ht.sale_status IN ('completed', 'refunded')`
  - `INNER JOIN product_configurations pc ON ht.product_name = pc.product_name`
  - `pc.target_bu = 'incorporador'` (na função geral) e `pc.target_bu = p_bu` (na função por BU)
  - Datas como `p_start_date::timestamptz` / `p_end_date::timestamptz`

- Reaplicar permissões (GRANT EXECUTE) para `anon` e `authenticated` na assinatura `text`.

### 2) Validar o resultado
- Recarregar a página `/bu-incorporador/transacoes`.
- Confirmar que:
  - o erro de “best candidate function” sumiu
  - voltaram as transações
  - não aparecem sources como `hubla_make_sync` (somente `hubla` e `manual`)

## Passos de implementação (frontend)

Nenhuma mudança deve ser necessária no frontend para resolver esta ambiguidade, pois o problema é a duplicidade de assinaturas no banco.

(Se ainda houver algum erro depois, aí sim o próximo passo seria ajustar o frontend para chamar explicitamente uma função com nome diferente, mas isso só se a padronização no banco não for suficiente.)

## Risco / Observações importantes

- Essa correção é “cirúrgica”: não mexe em dados, só em definição de funções.
- O risco principal é algum outro lugar do app estar chamando explicitamente a assinatura `timestamptz`. Pelos arquivos atuais, os calls usam strings, então a remoção da assinatura `timestamptz` é o caminho mais estável.

## Checklist de aceite (o que você verá na tela)
- A lista de transações deixa de mostrar erro e volta a preencher.
- “Fonte” mostra apenas `hubla` e `manual`.
- Filtros de data e busca continuam funcionando.
