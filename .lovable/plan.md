## Bug — toggle "Pré-agendamento" troca a lista de horários

Quando o usuário liga **Pré-agendamento** no `R2QuickScheduleModal`, a lista de horários muda: deixa de mostrar a grade real do closer (com :15, :45 etc.) e passa a misturar :00/:30 artificiais de 09:00–20:00 + os horários reais. Isso confunde — o esperado é que a grade continue sendo a **agenda real do closer**, só mudando a regra de capacidade (limite de pré-agendamentos no mesmo slot).

## Causa no código

`src/components/crm/R2QuickScheduleModal.tsx`:

- `allFreeTimeSlots` (linhas 143–151) gera `:00/:30` de 09:00 a 20:00 e adiciona os horários reais → vira uma lista enorme e diferente da grade normal.
- O `<Select>` (linhas 497–514) usa `allFreeTimeSlots` quando `isPreSchedule = true`, em vez de `allConfiguredSlots`.

## Correção

1. Em modo pré-agendamento, **usar `allConfiguredSlots` como base** (mesma grade real exibida no modo normal). Aplicar `MAX_PRE_SCHEDULE_PER_SLOT = 2` em cima disso:
   - `(lotado)` quando `preScheduledCounts[time] >= 2`
   - `(N/2)` quando há pré-agendamento parcial
   - `(encaixe)` quando há agendamento normal mas ainda cabe pré
2. **Remover a grade artificial `:00/:30`** do select principal — ela é o que está "trocando" os horários ao alternar o toggle.
3. Quando o closer **não tem nenhum slot configurado no dia**, manter um fallback simples (mostrar :00/:30 09:00–20:00 só nesse caso, com aviso "sem grade configurada — encaixe"), para não travar o pré-agendamento.
4. Resetar `selectedTime` quando `isPreSchedule` mudar, para evitar ficar com horário inválido.
5. Não mexer em: `useR2CloserAvailableSlots`, `useR2Bookers`, lógica de auto-detecção de R1 Closer, `MAX_PRE_SCHEDULE_PER_SLOT`, fluxo de confirmação.

## Arquivo

- `src/components/crm/R2QuickScheduleModal.tsx`

## Validação

- Logada como Jéssica Bellini (R1 Closer), abrir R2 → Jessica Martins → 07/05.
  - Toggle off: aparecem 13:45, 14:30, 15:15… (grade real).
  - Toggle on (pré-agendamento): **a mesma grade real continua aparecendo**; 13:00 marcado como "(encaixe)" se já tem 1 normal; 13:45 selecionável; conseguir concluir o pré-agendamento de Edvaldo.
- Closer sem slots configurados naquele dia + pré-agendamento ON: aparece fallback :00/:30 com aviso de encaixe.
- SDR não-R1-closer continua igual ao comportamento atual.
