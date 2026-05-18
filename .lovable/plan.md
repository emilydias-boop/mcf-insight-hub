## Objetivo

Hoje as marcações especiais R2 (ex.: "Anamnese Letícia") só aparecem no drawer de detalhes e nas abas Lista / Calendário. Na aba **Por Sócio** (`R2CloserColumnCalendar`) o card do lead mostra só o nome e o status, então não dá pra identificar de fora que o Neiton, por exemplo, é Anamnese da Letícia.

## O que muda

Adicionar, ao lado do nome de cada participante dentro do bloco do slot na aba "Por Sócio", o mesmo badge colorido de marcação especial que já aparece na Lista/Calendário (ícone + `badge_label`, cores definidas em Configurar Marcações).

Mesma regra de matching já usada em `AgendaCalendar.tsx` (linhas 309–369):
- `useActiveR2SpecialMarkings()` para carregar regras ativas
- `useAttendeeChannels()` para canal (A010 / ANAMNESE / Outro) por attendee
- `useContractPaidClosersByDeal()` para casar pelo closer que pagou contrato quando o R1 closer name não bate
- `matchR2SpecialMarking()` combinando canal + R1 closer / closer do contrato pago + `is_contract_paid` + data de referência (`scheduled_at`)

O resultado é um `Map<attendeeId, R2SpecialMarking>` consumido na renderização.

## Onde mexer

**Único arquivo de UI**: `src/components/crm/R2CloserColumnCalendar.tsx`

1. Adicionar imports: `useMemo` já existe; adicionar `useActiveR2SpecialMarkings`, `useAttendeeChannels`, `useContractPaidClosersByDeal`, `matchR2SpecialMarking`, tipo `R2SpecialMarking`.
2. Construir `channelInputs`, `channelMap`, `r2DealIds`, `contractPaidClosersByDeal` e `markingByAttendee` a partir de `meetings` (mesma lógica do `AgendaCalendar`, simplificada para R2-only).
3. Dentro do loop `meeting.attendees.slice(0, 2).map(...)` (linhas ~290–313), depois do nome e antes do badge de status, renderizar:

```tsx
{markingByAttendee.get(att.id) && (
  <span
    title={markingByAttendee.get(att.id)!.name}
    className="text-[9px] px-1 py-0 rounded shrink-0 inline-flex items-center gap-0.5"
    style={{
      backgroundColor: markingByAttendee.get(att.id)!.bg_color,
      color: markingByAttendee.get(att.id)!.text_color,
    }}
  >
    <span aria-hidden>{markingByAttendee.get(att.id)!.icon}</span>
    {markingByAttendee.get(att.id)!.badge_label}
  </span>
)}
```

4. Ajustar o layout flex da linha do attendee para acomodar o novo chip sem quebrar o status à direita (já é `flex items-center justify-between` — o chip entra no grupo da esquerda junto com o nome).
5. Opcional: replicar o chip dentro do `TooltipContent` (lista expandida) ao lado do nome, mantendo paridade visual com a Lista.

## Não muda

- Nada de backend / RPC / migração — usa hooks já existentes.
- Regras de marcação (cadastro em "Marcações") continuam idênticas.
- Comportamento de clique, tooltip de status, contadores de leads/dia ficam inalterados.

## Validação

- Abrir `/crm/agenda-r2` → aba **Por Sócio** na semana atual e confirmar que o card do Neiton (Jessica Martins, 11h) exibe o chip "Anamnese Letícia" do lado do nome.
- Conferir que slots sem marcação aplicável seguem sem chip.
- Conferir que filtros (closer R1, status) e click → drawer continuam funcionando.