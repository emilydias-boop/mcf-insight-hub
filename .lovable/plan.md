
Diagnóstico confirmado para `/crm/reunioes-equipe?preset=month&month=2026-04`:

- A diferença restante entre as abas não vem de BU diferente.
- Ela vem de 2 regras ainda desalinhadas entre a aba SDR e a aba Closer:
  1. `rescheduled`: a RPC dos SDRs inclui esses attendees em `r1_agendada`, mas `useR1CloserMetrics` não inclui.
  2. `outside`: `useR1CloserMetrics` remove esses leads de todas as métricas R1 (`r1_agendada`, `r1_realizada`, `noshow`), enquanto a RPC dos SDRs mantém esses registros no cálculo.

No snapshot atual, isso explica exatamente a sobra:
- `+11` em No-Show = attendees `rescheduled`
- `+4` em R1 Realizada = attendees marcados como `outside` que hoje entram no SDR e são excluídos no Closer
- `+15` em R1 Agendada = `11 rescheduled + 4 outside`

Plano de implementação:

1. Ajustar `src/hooks/useR1CloserMetrics.ts` para espelhar a mesma regra da aba SDR
   - Incluir `'rescheduled'` em `allowedAgendadaStatuses`
   - Parar de dar `return` no bloco que exclui `outside` das métricas R1
   - Manter `outside` como métrica separada, mas sem retirar esses registros da base de `r1_agendada` e `r1_realizada`

2. Manter o cálculo de `noshow` por subtração
   - Continuar com:
   ```ts
   noshow = r1_agendada - r1_realizada
   ```
   - Assim a equipe continua vendo o que precisa ser corrigido

3. Pequeno ajuste de consistência visual
   - Corrigir o tooltip de `Taxa No-Show` em `src/components/sdr/TeamKPICards.tsx`
   - Hoje o texto fala “No-Shows / Total Agendamentos”, mas o código usa base `R1 Agendada`

4. Validar novamente o mês 04/2026
   - Aba SDR e aba Closer devem bater em:
     - `R1 Agendada`
     - `R1 Realizada`
     - `No-Show`
   - Com o snapshot atual, a expectativa é alinhar o Closer para os mesmos totais visíveis no SDR:
     - `R1 Agendada: 371`
     - `R1 Realizada: 179`
     - `No-Show: 192`

Detalhes técnicos:
- Arquivo principal a alterar: `src/hooks/useR1CloserMetrics.ts`
- Não precisa migration nem mudança de RPC para esse ajuste
- A ideia é preservar a lógica já aprovada por você na aba SDR e fazer a aba Closer usar a mesma base operacional
