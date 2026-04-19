
## Confirmação: bug confirmado, nada de nota se perde

### O que verifiquei no banco

Rodei query em `deal_activities` para os 3 deals. Resultado:

| Lead | Deal ID | Notas tipo `note` no banco |
|---|---|---|
| **Franklin Silveira** | `b817d815...` | **1 nota**: "lead participou da reunião com o João Pedro, mas quer financiamento, aguardando definiri horário" (16/04 14:05) |
| **José Henrique** | `fec3d199...` | **1 nota**: "LEAD QUER AGENDAR PARA QUARTA ÀS 18H COM O SÓCIO" (17/04 19:52) |
| **Ricardo Souza** | `6658165e...` | **0 notas** tipo `note` (só `stage_change`) |

### Bug confirmado em `AgendaMeetingDrawer.tsx` linha 272

```ts
const dealId = activeMeeting?.deal_id;  // ← deal do PRIMEIRO que reservou (Franklin)
```

Como o `meeting_slots.deal_id` é fixo no Franklin (1º a reservar), todos os 3 drawers buscam as notas do Franklin → você vê a mesma frase em todos.

### Após a correção, cada drawer mostrará:

- **Franklin** → "lead participou da reunião com o João Pedro..." ✅
- **José Henrique** → "LEAD QUER AGENDAR PARA QUARTA ÀS 18H COM O SÓCIO" ✅ (nota própria que estava escondida pelo bug!)
- **Ricardo** → vazio (correto — ele realmente não tem nota)

**Importante:** o José Henrique TEM nota própria que hoje você nem está vendo, porque o bug sobrescreve com a do Franklin. A correção **revela** essa nota que estava escondida.

### Plano de implementação

**Arquivo:** `src/components/crm/AgendaMeetingDrawer.tsx`

**Linha 272-289** — trocar `activeMeeting?.deal_id` por `selectedParticipant?.dealId`:

```ts
const selectedDealId = selectedParticipant?.dealId;
const { data: sdrNotes } = useQuery({
  queryKey: ['deal-sdr-notes', selectedDealId],
  queryFn: async () => {
    if (!selectedDealId) return [];
    const { data, error } = await supabase
      .from('deal_activities')
      .select('id, description, created_at')
      .eq('deal_id', selectedDealId)
      .eq('activity_type', 'note')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  enabled: !!selectedDealId,
});
```

**Atualizar título** para deixar claro de quem é a nota: `Notas do SDR sobre {primeiro nome do participante selecionado}`.

### Garantias
- Zero alterações de banco — nenhuma nota é deletada
- Zero impacto em outros componentes (`useLeadNotes`, `AttendeeNotesSection` etc.)
- Cada nota volta a aparecer no drawer correto
- Histórico, contadores e demais painéis intactos
