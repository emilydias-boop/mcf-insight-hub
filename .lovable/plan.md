
## Objetivo

Hoje, no **Relatórios → Aquisição → Funil por Canal** (BU Incorporador), as colunas **R2 Agendada / R2 Realizada / Aprovados / Reprovados / Próx. Semana** mostram dados de **semanas inteiras do carrinho (Sex→Qui)** que “tocam” o período escolhido. Isso causa descasamento com **Entradas / R1 Agendada / R1 Realizada / Contrato Pago**, que respeitam o intervalo exato.

Vamos passar a contar **R2/Carrinho dentro do mesmo intervalo de datas** selecionado, eliminando o descasamento.

---

## Onde está o problema

Arquivo: **`src/hooks/useChannelFunnelReport.ts`** (linhas 202-249).

O hook constrói uma lista `weeksInRange` com todas as semanas-carrinho que tocam o período e chama `get_carrinho_r2_attendees` uma vez por semana, com `p_window_start/p_window_end` cobrindo a semana inteira:

```ts
const weeksInRange = useMemo(() => {
  // ...itera de getCartWeekStart(from) até getCartWeekStart(to), uma semana de cada vez
});

for (const w of weeksInRange) {
  await supabase.rpc('get_carrinho_r2_attendees', {
    p_week_start: format(w.start, 'yyyy-MM-dd'),
    p_window_start: w.start.toISOString(),                                  // semana cheia
    p_window_end: new Date(w.end.setHours(23,59,59,999)).toISOString(),     // semana cheia
    p_apply_contract_cutoff: false,
    p_previous_cutoff: w.start.toISOString(),
  });
}
```

Exemplo do efeito atual: período **02/04 → 10/04** acaba puxando R2s de **28/03 → 18/04** (semanas inteiras tocadas), e por isso R2/Aprovados ficam maiores que Entradas/R1.

---

## Mudança proposta (única, cirúrgica)

Substituir o loop por **uma única chamada** ao RPC, passando exatamente o intervalo escolhido pelo usuário:

```ts
// Em vez de weeksInRange + loop:
const { data, error } = await supabase.rpc('get_carrinho_r2_attendees', {
  p_week_start: format(dateRange.from, 'yyyy-MM-dd'),     // só satisfaz a assinatura
  p_window_start: startOfDay(dateRange.from).toISOString(),
  p_window_end:   endOfDay(dateRange.to).toISOString(),
  p_apply_contract_cutoff: false,
  p_previous_cutoff: startOfDay(dateRange.from).toISOString(),
});
```

A assinatura da RPC `get_carrinho_r2_attendees(p_week_start date, p_window_start tstz, p_window_end tstz, p_apply_contract_cutoff bool, p_previous_cutoff tstz)` aceita janela arbitrária — ela já filtra reuniões R2 por `scheduled_at BETWEEN p_window_start AND p_window_end`. Não há mudança de SQL/RPC necessária.

### Ajustes no código (em `useChannelFunnelReport.ts`)

1. **Remover** o `useMemo` de `weeksInRange` e a variável `carrinhoKey` baseada em semanas.
2. **Reescrever** o `useQuery(['funnel-carrinho', ...])` para fazer **uma única chamada** com `p_window_start = startDate 00:00 BRT` e `p_window_end = endDate 23:59 BRT`, usando o mesmo padrão de timezone já usado no resto do hook (`-03:00`).
3. **`queryKey`**: trocar `carrinhoKey` por `[startDate, endDate, bu]` (mesma chave usada em `channel-funnel-metrics`), garantindo cache coerente.
4. **Remover** o import `getCartWeekStart`, `getCartWeekEnd`, `addWeeks` se não forem mais usados.
5. **Remover** a chamada redundante a `useAcquisitionReport` se ela só era usada para `acq.isLoading` (manter apenas se ainda for necessária para algum outro estado).

### Comportamento esperado depois

- **R2 Agendada**: R2s com `scheduled_at` dentro do intervalo (excluindo cancelados/reagendados).
- **R2 Realizada**: R2s `completed/contract_paid/refunded` dentro do intervalo.
- **Aprovados / Reprovados / Próxima Semana**: contagem de status do R2 cujo R2 ocorreu dentro do intervalo.
- **Entradas / R1 / Contrato Pago / Venda Final**: já estavam alinhados ao intervalo — agora todas as colunas comparam o mesmo período.

---

## Implicações que vale o usuário saber

1. **Aprovados “históricos” não aparecem mais** se o R2 foi agendado fora do intervalo. Antes, ao pegar um período curto no meio de uma semana, R2s do início e fim da semana eram somados; isso vai parar.
2. **Conversão `Aprovado → Venda Final`** ficará mais coerente: ambos baseados em eventos dentro do mesmo intervalo. Pode subir ou descer dependendo da janela escolhida.
3. **`Contrato Pago` (vindo do RPC R1) vs `Venda Final` (Hubla)** continuam sendo métricas diferentes (operacional vs. financeiro) — esse descasamento não muda, apenas o do Carrinho.

---

## Arquivos afetados

- `src/hooks/useChannelFunnelReport.ts` — única mudança de código.
- Sem migração de banco, sem mudança em RPCs, sem mudança em UI/`ChannelFunnelTable.tsx`.

---

## Fora de escopo (não vou tocar agora, posso fazer depois se você quiser)

- Adicionar tooltips em cada coluna explicando “contagem por evento dentro do intervalo”.
- Aplicar a mesma normalização ao **Carrinho R2 da BU Incorporador** (`/bu-incorporador/carrinho-r2`), que continua corretamente operando por semana-safra (lógica de negócio diferente — não é Funil).
- Adicionar um indicador visual no header do Funil avisando “R2 contado por data de R2, não por safra”.

