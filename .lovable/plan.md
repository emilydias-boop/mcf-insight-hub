

## Corrigir "No-Show" inflado pelos Pendentes na aba SDRs/Closers Incorporador

### Diagnóstico

No `src/hooks/useR1CloserMetrics.ts` (linhas 521-524), o cálculo de `noshow` está sendo feito por **subtração**:

```ts
metricsMap.forEach(metric => {
  metric.noshow = Math.max(0, metric.r1_agendada - metric.r1_realizada);
});
```

Isso é matematicamente errado: tudo que **ainda não aconteceu** (pendentes com status `scheduled`/`invited`/`rescheduled`) cai no "no-show" porque ainda não está em `r1_realizada`.

**Evidência (preset Hoje, 23/04, BU Incorporador):**

| Status real (DB) | Quantidade |
|---|---|
| `invited` (pendente) | 38 |
| `rescheduled` (pendente) | 6 |
| `completed` | 8 |
| `contract_paid` | 5 |
| `no_show` (real) | **7** |

Painel mostra **No-Shows = 51** e **Taxa No-Show = 79.7%**. Conta bate: `64 (agendada) − 13 (realizada) = 51`. Os 44 pendentes estão sendo classificados como no-show.

A confusão veio do hook usar contagem deduplicada por deal (max 2x por `r1_agendada`), o que torna inviável contar `no_show` direto da tabela com a mesma deduplicação. A solução correta é deduplicar `no_show` da mesma forma — não usar subtração.

### Correção

**Arquivo:** `src/hooks/useR1CloserMetrics.ts`

1. Adicionar um campo `noshow` ao objeto `entry` da deduplicação (linhas 504-508), marcando `noshow = true` quando `status === 'no_show'` e nenhum attendee do deal tem status final realizado.

2. Aplicar `noshow` na fase de agregação (linhas 512-519), incrementando `metric.noshow++` quando `entry.noshow === true && entry.realized === false` (deal só conta como no-show se nenhum dos seus attendees foi realizado — evita dupla contagem em remarcações que viraram completed).

3. **Remover** o bloco de subtração (linhas 521-524).

Pseudocódigo da nova lógica:

```ts
// dentro do forEach de meetings:
if (status === 'no_show') entry.noshow = true;
if (['completed','contract_paid','refunded'].includes(status)) entry.realized = true;

// na agregação:
dealMap.forEach(({ days, realized, noshow }) => {
  metric.r1_agendada += days.size >= 2 ? 2 : 1;
  if (realized) metric.r1_realizada++;
  else if (noshow) metric.noshow++;
});
```

A regra `else if` garante que um deal que foi `no_show` numa primeira reunião e depois `completed` numa segunda conte como **realizada**, não como no-show — alinhado com a regra de negócio "Realizada vence No-Show por deal".

### Resultado esperado (Hoje, 23/04)

- **No-Shows** passa de 51 → 7 (valor real)
- **Taxa No-Show** passa de 79.7% → ~10.9% (7/64)
- **R1 Agendada** continua 64
- **R1 Realizada** continua 13
- **Pendentes Hoje (44)** aparece só no card próprio, não infla mais o no-show
- Por SDR a coluna No-show já estava correta (vem de outro hook, `useTeamMeetingsData`); só o agregado/Closers vai ajustar

### Impacto colateral (avaliado e seguro)

- A função `useR1CloserMetrics` é usada em:
  - `ReunioesEquipe.tsx` (esta tela) — corrige
  - Outras páginas que mostrem ranking de Closer R1 — também passam a mostrar no-show real

- O painel de **Closers** (segundo screenshot) também é alimentado por esse hook. Hoje mostra Julio com No-show 16 / Taxa 100% — depois do fix mostrará apenas os no-shows reais dele.

- **R2** (`useR2CloserMetrics`) tem a mesma lógica de subtração mas é outro hook; **não está no escopo deste plano** — se você confirmar que o problema também aparece na aba R2, abro um plano separado.

### Reversibilidade

Mudança isolada em ~10 linhas de um único arquivo. Reverter = restaurar o bloco de subtração.

### Fora do escopo

- Não vou tocar no RPC `get_sdr_metrics_from_agenda` — ele já calcula no-show corretamente (`status = 'no_show'`).
- Não vou alterar `useMeetingsPendentesHoje` — está correto.
- Não vou mexer no `useR2CloserMetrics` sem confirmação separada de que tem o mesmo problema na prática.

