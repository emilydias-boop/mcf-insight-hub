

## Plano: Adicionar "Perfil do Lead" nos drawers de agendamento

### Problema
Leads com dados de anamnese preenchidos (via `lead_profiles`) não mostram essas informações nos drawers de reunião. O closer precisa sair do drawer para ver o perfil.

### Solução
Reutilizar o componente `LeadProfileSection` existente nos dois drawers de agendamento:

### Alterações

| Arquivo | Ação |
|---------|------|
| `src/components/crm/AgendaMeetingDrawer.tsx` | Importar `LeadProfileSection` e renderizar abaixo das notas do SDR, usando `contact_id` do `MeetingSlot` ou do attendee selecionado |
| `src/components/crm/R2MeetingDetailDrawer.tsx` | Importar `LeadProfileSection` e renderizar dentro da área do attendee selecionado (antes ou depois das tabs de Qualificação/Avaliação/Notas), usando o `contactId` já calculado na linha 93 |

### Detalhes técnicos

**AgendaMeetingDrawer (R1):** O `contact_id` já existe em `MeetingSlot` e `MeetingAttendee`. Renderizar `<LeadProfileSection contactId={meeting.contact_id || selectedParticipant?.contactId} />` na seção de detalhes do participante selecionado.

**R2MeetingDetailDrawer:** Já calcula `contactId` na linha 93. Renderizar `<LeadProfileSection contactId={contactId} />` logo acima das tabs (Qualificação/Avaliação/Notas), apenas quando há um attendee selecionado.

O `LeadProfileSection` já:
- Faz fetch via `useLeadProfile(contactId)`
- Retorna `null` se não há dados ou está carregando
- Mostra collapsible com categorias (Pessoais, Financeiro, Patrimônio, Interesse)

Nenhuma alteração no hook ou no componente de perfil é necessária.

