

## Diagnóstico final

A correção do cutoff foi aplicada, mas **só no Carrinho R2 (KPIs de cima)**. A aba **Relatório** continua chamando a RPC **sem** `p_previous_cutoff`, então cai no `DEFAULT NULL` e usa Qui 00:00 como início da janela — voltando ao bug antigo.

Comparando sua lista (44) com a tela:

**Aprovado 46 (Relatório)** = 18 leads com R2 nesta semana realmente dentro do corte + 11 intrusos da safra anterior (R2 entre Qui 00:00 e Sex 12:00 com contrato anterior a Sex 12:00) + ~17 órfãos Hubla (contrato pago na semana, sem R2 nesta semana — somam em "Total Pagos" e em Aprovado).

**Aprovado (fora do corte) 10** = leads com R2 nesta semana mas contrato fora da janela operacional.

### Sobre os 10 "fora do corte"

**Sim, esses 10 deveriam aparecer no próximo carrinho.** Eles já aparecem — quando você navega para a próxima safra, eles entram como "dentro do corte" daquela semana, porque o contrato cai dentro da nova janela `[Sex 12:00 atual, Sex 12:00 próximo)`. A categoria "Aprovado (fora do corte)" só existe como **alerta visual** na semana onde o R2 aconteceu para mostrar leads que tecnicamente pertencem a outra safra. Não é bug, é semântica: R2 aconteceu aqui, mas o contrato pertence a outra cohort.

## Correções necessárias

### 1. `src/hooks/useContractLifecycleReport.ts` (linhas 127–135)
Passar `p_previous_cutoff` igual ao `useCarrinhoUnifiedData`:

```diff
- const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd);
+ const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd);

  const rpcPromise = supabase.rpc('get_carrinho_r2_attendees', {
    p_week_start: weekStartStr,
    p_window_start: boundaries.r2Meetings.start.toISOString(),
    p_window_end: boundaries.r2Meetings.end.toISOString(),
    p_apply_contract_cutoff: true,
+   p_previous_cutoff: boundaries.previousCutoff.toISOString(),
  });
```

Resultado esperado:
- Aprovado dentro do corte: cai de **46 → ~33** (18 com R2 nesta semana + ~15 órfãos Hubla com contrato pago após Sex 12:00 anterior)
- Aprovado (fora do corte): sobe de **10 → ~22** (10 atuais + 12 intrusos migrados)
- "Total Pagos" não muda (continua contando todos os contratos pagos no range)

### 2. (Opcional, não vou tocar agora) Reforçar visualmente a separação
A aba Carrinho R2 já mostra os números corretos (18+22). A aba Relatório vai ficar consistente após o fix acima.

### Escopo
- 1 linha adicionada em `useContractLifecycleReport.ts`
- Zero migrations (RPC já aceita o parâmetro com DEFAULT NULL)
- Zero impacto em outras telas

