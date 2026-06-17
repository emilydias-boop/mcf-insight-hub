# Plano: Confirmação do filtro de data e tratamento da linha sem nome

## Contexto

Você validou o inspect (40 matches + 1 fora por falta de nome) e perguntou se o filtro de `16/06/2026` na tela `/crm/transacoes-hubla` cobre realmente `00:00–23:59` no horário de Brasília.

## Resposta sobre o filtro de data (sem mudança de código necessária)

Confirmado, o filtro já opera em horário de Brasília (UTC−3):

- `src/hooks/useAllHublaTransactions.ts` envia explicitamente:
  - `p_start_date = "2026-06-16T00:00:00-03:00"`
  - `p_end_date = "2026-06-16T23:59:59-03:00"`
- RPC `public.get_all_hubla_transactions` aplica:
  - `ht.sale_date >= p_start_date::timestamptz`
  - `ht.sale_date <= p_end_date::timestamptz`
- Como `sale_date` é `timestamptz`, a comparação é por instante absoluto — o offset `-03:00` garante exatamente a janela do dia 16/06 em Brasília, independente de DST ou de como o valor está armazenado em UTC.

Conclusão: o card "A010 - 16/06/2026" no filtro corresponde a vendas entre 16/06 00:00:00 BRT e 16/06 23:59:59 BRT.

## Mudança que vou implementar (aceitar linha sem nome)

Atualmente o `inspect`/`apply` em `supabase/functions/backfill-a010-from-spreadsheets/index.ts` descarta linhas da planilha sem `customer_name`. Vou:

1. **Edge function `backfill-a010-from-spreadsheets`**
   - Remover o descarte por nome ausente.
   - Quando `customer_name` vier vazio/nulo, usar fallback `"Sem nome (A010)"` ao montar `inspectRow` e ao criar contato/deal no `mode: 'apply'`.
   - Marcar essas linhas com flag `missing_name: true` no payload de inspect para destaque na UI.

2. **UI `src/pages/crm/RecuperacaoA010.tsx`**
   - Adicionar badge `Sem nome` na linha correspondente nas três abas (matched_by_email, matched_by_phone_only, no_match) usando o flag.
   - Manter a linha selecionável por padrão (não bloquear apply).

3. **Hook `src/hooks/useA010RecoveryInspect.ts`**
   - Sem mudanças além de tipar `missing_name?: boolean` no item retornado.

## Fora de escopo
- Mudar lógica de janela de data (já está correta).
- Implementar `mode: 'apply'` definitivo (continua aguardando sua confirmação linha-a-linha; o suporte a linha-sem-nome só prepara o terreno).
- Investigar a divergência Kiwify/Hubla.
