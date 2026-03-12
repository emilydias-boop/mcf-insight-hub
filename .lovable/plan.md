

## Problema: SDR só aparece quando tem Closer

### Causa raiz

No `useAcquisitionReport.ts` (linhas 310-334), o SDR é extraído do **mesmo `matchedAttendee`** que o Closer R1. O `matchedAttendee` vem do match email/telefone com `meeting_slot_attendees` de reuniões R1.

Fluxo atual:
1. Se a origem é automática (A010, Vitalício, etc.) → `matchedAttendee = null` → SDR = nome da origem
2. Se não é automática mas não há match de email/telefone na agenda R1 → `matchedAttendee = null` → SDR = "Sem SDR"
3. Só quando há match na agenda R1 → `matchedAttendee` existe → pega `booked_by` ou `owner_profile_id` → SDR real

Ou seja, SDR só é preenchido quando a transação faz match com um attendee R1 (que é o mesmo match que traz o Closer).

### Correção

Adicionar no `SalesReportPanel.tsx` uma **query independente de SDR** que busca o `owner_profile_id` dos `crm_deals` pelo email do cliente, sem depender do match com a agenda R1.

**Arquivo: `src/components/relatorios/SalesReportPanel.tsx`**

1. Nova query: buscar `crm_deals` com `crm_contacts(email)` e `profiles(full_name)` via `owner_profile_id`, construindo mapa `email → sdrName`
2. No `getEnrichedData`, usar o SDR do `classifiedByTxId` como prioridade, e fazer fallback para o mapa independente de CRM deals quando o classified retorna '-'

```typescript
// Nova query de SDR independente via CRM deals
const { data: crmDealOwners = [] } = useQuery({
  queryKey: ['crm-deal-owners-by-email', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('crm_deals')
      .select('owner_profile_id, contact:crm_contacts!contact_id(email), owner:profiles!crm_deals_owner_profile_id_fkey(full_name)')
      .not('owner_profile_id', 'is', null);
    if (error) throw error;
    return data || [];
  },
});

const sdrByEmail = useMemo(() => {
  const m = new Map<string, string>();
  crmDealOwners.forEach(d => {
    const email = (d.contact?.email || '').toLowerCase().trim();
    const name = d.owner?.full_name;
    if (email && name) m.set(email, name);
  });
  return m;
}, [crmDealOwners]);

// Atualizar getEnrichedData:
const sdr = (info?.sdrName && !AUTOMATIC_ORIGIN_NAMES.has(info.sdrName))
  ? info.sdrName
  : (sdrByEmail.get(email) || '-');
```

Isso garante que o SDR apareça mesmo sem match de Closer R1, bastando o lead ter um deal no CRM com owner atribuído.

