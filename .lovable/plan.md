

# Corrigir SDR e Closer R1 no drawer da Agenda R2

## Problema
No "Historico do Funil" do drawer R2:
1. **SDR** mostra o dono atual do deal (`deal.owner_id`) que apos transferencia vira o Closer
2. **Closer R1** as vezes aparece como "—" quando deveria mostrar nome e data

## Solucao
Alterar `src/hooks/useR2MeetingsExtended.ts` para derivar o SDR a partir do `booked_by` da R1 (quem agendou), em vez do `deal.owner_id`.

## Secao tecnica

### Arquivo: `src/hooks/useR2MeetingsExtended.ts`

**1. Adicionar `booked_by` na query de R1** (linha 138):
- Mudar `attendees:meeting_slot_attendees(deal_id, notes)` para `attendees:meeting_slot_attendees(deal_id, notes, booked_by)`

**2. Criar mapa `r1SdrMap`** (apos linha 159):
- Mapear `deal_id -> booked_by` (UUID) do R1
- Dentro do forEach dos r1Meetings, salvar `att.booked_by` no mapa

**3. Coletar booked_by UUIDs do R1 para buscar profiles** (linha 163):
- Adicionar os UUIDs do `r1SdrMap` ao array `bookedByIds` para que sejam buscados no `profilesById`

**4. Substituir logica do SDR** (linhas 219-222):
- Em vez de usar `deal.owner_id`, usar `r1SdrMap[dealId]` com lookup no `profilesById`
- Fallback para `deal.owner_id` se nao houver R1 booked_by

```text
Antes:  deal.owner_id -> profilesByEmail -> SDR (incorreto)
Depois: R1.attendee.booked_by -> profilesById -> SDR (correto)
        Fallback: deal.owner_id
```

Nenhuma alteracao no componente `R2MeetingDetailDrawer.tsx` - ele ja exibe `meeting.sdr.name` e `meeting.r1_closer` corretamente.
