

## Corrigir exclusao de deals (leads) no CRM

### Problema identificado

Ao tentar excluir um deal, a operacao falha silenciosamente por causa de restricoes de chave estrangeira (FOREIGN KEY) em 4 tabelas que referenciam `crm_deals` sem `ON DELETE CASCADE` ou `ON DELETE SET NULL`:

1. **`meeting_slot_attendees.deal_id`** - sem acao de delete definida (RESTRICT por padrao)
2. **`consorcio_pending_registrations.deal_id`** - sem acao de delete definida
3. **`whatsapp_conversations.deal_id`** - sem acao de delete definida
4. **`crm_deals.replicated_from_deal_id`** - auto-referencia sem acao de delete definida

Quando um deal tem registros nessas tabelas, o Postgres rejeita o DELETE com um FK violation, mas o erro pode estar sendo engolido pelo RLS ou pela falta de tratamento adequado.

### Alteracoes

**1. Migracao SQL** - Alterar as 4 foreign keys para permitir exclusao:

- `meeting_slot_attendees.deal_id` → `ON DELETE CASCADE` (exclui attendees junto com o deal)
- `consorcio_pending_registrations.deal_id` → `ON DELETE CASCADE`
- `whatsapp_conversations.deal_id` → `ON DELETE SET NULL`
- `crm_deals.replicated_from_deal_id` → `ON DELETE SET NULL`

**2. `src/hooks/useCRMData.ts`** - Melhorar o hook `useDeleteCRMDeal`:

- Adicionar invalidacao de queries relacionadas (`agenda-meetings`, `meeting-slots`, `crm-contacts-with-deals`) no `onSuccess`
- Garantir que o drawer feche apos exclusao bem-sucedida

**3. `src/components/crm/QuickActionsBlock.tsx`** - Garantir que o `handleDelete`:

- Feche o drawer pai (`onOpenChange(false)`) apos exclusao bem-sucedida, para que o lead desapareca da UI

### Resultado

A exclusao de deals funcionara corretamente, removendo registros dependentes e atualizando a UI (drawer fecha, listas recarregam).

