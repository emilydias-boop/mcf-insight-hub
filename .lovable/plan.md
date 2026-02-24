

## Adicionar edição de telefone e email do lead no Drawer R2

### Contexto

No drawer de detalhes R2, o telefone e email do lead são exibidos mas não podem ser editados. O telefone vem de `meeting_slot_attendees.attendee_phone` e o email vem de `crm_contacts.email` (via join no deal).

### Alterações

**1. `src/hooks/useR2AttendeeUpdate.ts`**
- Adicionar `attendee_name` e `attendee_phone` na interface `UpdateAttendeeData.updates` para permitir atualização direta do telefone no registro do attendee

**2. `src/components/crm/R2MeetingDetailDrawer.tsx`**
- Na seção de "Meeting Info" (linhas 288-300), onde o telefone é exibido, transformar em campo editável inline (igual ao padrão usado no `SdrSummaryBlock`): ao clicar num ícone de edição, aparece um Input para editar o telefone, com botões de salvar/cancelar
- Adicionar campo de email editável na mesma seção, abaixo do telefone
- Para o telefone: atualizar `meeting_slot_attendees.attendee_phone` via `useUpdateR2Attendee` E `crm_contacts.phone` via `useUpdateCRMContact` (se houver contact vinculado)
- Para o email: atualizar `crm_contacts.email` via `useUpdateCRMContact` (email só existe na tabela de contatos)

**3. `src/components/crm/r2-drawer/R2QualificationTab.tsx`** (opcional, mas consistente)
- Nenhuma alteração necessária aqui -- a edição será no drawer principal, na seção de info do lead

### Fluxo do usuário

1. Abre o drawer R2 do lead
2. Na seção de informações, vê o telefone e email com ícone de edição (lápis)
3. Clica no lápis -> campo vira editável
4. Edita o valor -> clica em salvar (check) ou cancelar (X)
5. Salva no banco: telefone atualiza tanto no attendee quanto no contato; email atualiza no contato

### Detalhes técnicos

O telefone será salvo em dois lugares:
- `meeting_slot_attendees.attendee_phone` (registro da reunião)
- `crm_contacts.phone` (registro do contato, se existir `deal.contact`)

O email será salvo em:
- `crm_contacts.email` (único local onde existe)

Será usado o `useUpdateR2Attendee` (já existente, precisa expandir a interface) para o attendee e o `useUpdateCRMContact` para o contato.

