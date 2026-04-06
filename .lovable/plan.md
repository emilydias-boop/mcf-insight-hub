

# Corrigir "Meu Fechamento" para Closers Consórcio

## Diagnóstico

Victoria tem dois registros de payout em tabelas diferentes:

| Tabela | Mês 2026-03 | Status |
|--------|------------|--------|
| `sdr_month_payout` | R$ 3.430 | **DRAFT** |
| `consorcio_closer_payout` | R$ 7.945 | **LOCKED** |

O hook `useOwnFechamento` só consulta `sdr_month_payout`. Como o registro lá está DRAFT, a tela filtra com `visiblePayout = null` e mostra "Nenhum fechamento encontrado".

O fechamento real da Victoria (LOCKED, R$ 7.945) está em `consorcio_closer_payout` — e a página "Meu Fechamento" simplesmente não sabe que essa tabela existe.

Adicionalmente, `sdr.user_id` da Victoria é `null`, então o hook nem encontra o registro pelo `user_id` (precisa do fallback por email).

## Solução

### 1. Atualizar `src/hooks/useOwnFechamento.ts`

Para closers do squad `consorcio`, adicionar uma query ao `consorcio_closer_payout`:
- Buscar o closer_id via tabela `closers` (pelo email do SDR)
- Consultar `consorcio_closer_payout` filtrado por `closer_id` + `ano_mes`
- Se encontrar um payout consórcio com status != DRAFT, usar esse como payout principal
- Mapear os campos do `consorcio_closer_payout` para o formato `SdrPayoutWithDetails` que a tela espera (OTE, fixo, variável, total_conta, status, etc.)
- Prioridade: consórcio payout > sdr payout (para closers consórcio)

### 2. Atualizar `src/pages/fechamento-sdr/MeuFechamento.tsx`

- Quando o payout vem do consórcio, o botão "Ver Detalhes" deve navegar para `/consorcio/fechamento/{id}` em vez de `/fechamento-sdr/{id}`
- Adicionar flag `isConsorcioPayout` no retorno do hook para distinguir a rota
- O `SdrStatusBadge` já suporta os mesmos status (DRAFT/APPROVED/LOCKED)

### 3. Vincular `user_id` no registro da Victoria

- A `sdr.user_id` da Victoria é null. Isso impede o hook de encontrá-la pelo método primário
- Corrigir via migration: `UPDATE sdr SET user_id = '5a702a6c-...' WHERE email = 'victoria.paz@minhacasafinanciada.com'`
- Isso resolve também para outros closers consórcio que possam ter `user_id` null

## Arquivos alterados
1. `src/hooks/useOwnFechamento.ts` — query adicional para `consorcio_closer_payout`
2. `src/pages/fechamento-sdr/MeuFechamento.tsx` — rota dinâmica para detalhes
3. Migration SQL — vincular user_id da Victoria

## Resultado esperado
- Victoria acessa "Meu Fechamento", seleciona março 2026, e vê seu fechamento LOCKED de R$ 7.945
- Botão "Ver Detalhes" abre `/consorcio/fechamento/3da8c2b3-...`
- NFSe e demais funcionalidades funcionam normalmente

