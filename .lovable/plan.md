

## Plano: Adicionar "Reconhecer Recorrência" no Pendentes R2 + Filtro

### Alterações

**1. Novo hook `src/hooks/useRecognizeRecurrence.ts`**

Idêntico ao `useRecognizePartner`, mas com:
- `return_source: 'manual_recurrence'`
- `partner_product: 'Reconhecido como recorrência - Pendentes R2'`
- Status do attendee: `'recurrence_recognized'`
- Activity type: `'recurrence_recognized'`
- Toast: "Lead reconhecido como recorrência com sucesso"
- Invalida: `r2-pending-leads`, `partner-returns`, `r2-agenda`

**2. `src/components/crm/R2PendingLeadsPanel.tsx`**

- Importar `useRecognizeRecurrence` e ícone `Repeat` do lucide-react
- Adicionar estados `recurrenceDialogOpen` e `recurrenceLead`
- Adicionar 4ª opção no DropdownMenu: "Reconhecer Recorrência" (ícone Repeat, cor verde)
- Adicionar AlertDialog de confirmação para recorrência (similar ao de parceiro)

**3. `src/hooks/useR2PendingLeads.ts`**

- No filtro de resultados, excluir attendees com `status` igual a `'recurrence_recognized'` ou `'partner_recognized'` (fallback para caso dados antigos ainda apareçam)

