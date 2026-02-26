

## Plano: Opção C — Duas colunas na aba R2: "SDR (R1)" e "Agendado por"

### Alterações

**1. `src/hooks/useCloserDetailData.ts`**

Na query `closer-r2-leads`, após obter os `r1DealIds`, também buscar o `booked_by` do R1 original para cada `deal_id`:

```typescript
// Buscar booked_by do R1 para cada deal_id
const { data: r1Sdr } = await supabase
  .from('meeting_slot_attendees')
  .select('deal_id, booked_by, meeting_slot:meeting_slots!inner(meeting_type)')
  .in('deal_id', Array.from(r1DealIds))
  .eq('meeting_slot.meeting_type', 'r1')
  .order('created_at', { ascending: false });
```

Montar um mapa `deal_id → booked_by do R1` (primeiro match = mais recente). Buscar profiles desses IDs junto com os do R2. Adicionar campo `r1_sdr_name` ao retorno.

**2. `src/hooks/useCloserDetailData.ts` — tipo `CloserLead`**

Adicionar campo opcional:
```typescript
r1_sdr_name?: string | null;
```

**3. `src/components/closer/CloserLeadsTable.tsx`**

- Aceitar prop `showR1Sdr?: boolean` (default `false`)
- Quando `true`: renomear header "SDR" para "SDR (R1)" e adicionar coluna "Agendado por" após ela
- "SDR (R1)" mostra `lead.r1_sdr_name`; "Agendado por" mostra `lead.booked_by_name`

**4. `src/pages/crm/CloserMeetingsDetailPage.tsx`**

Na aba R2, passar `showR1Sdr={true}` ao `CloserLeadsTable`.

