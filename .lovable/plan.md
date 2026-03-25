

## Corrigir perfil do lead não aparecendo no drawer do Controle Diego

### Problema
O perfil do lead (anamnese) não está aparecendo no drawer, mesmo quando o lead veio por webhook de anamnese e tem perfil preenchido. O `useLeadProfile` busca apenas por `contact_id`, mas em alguns casos o `lead_profiles` pode estar vinculado pelo `deal_id` em vez do `contact_id`, ou o `contact_id` no deal está nulo.

### Solução
Alterar `useLeadProfile` para aceitar ambos os identificadores (`contactId` e `dealId`) e fazer fallback:
1. Buscar por `contact_id` primeiro
2. Se não encontrar, buscar por `deal_id`

### Alterações

#### 1. `src/hooks/useLeadProfile.ts`
- Adicionar parâmetro `dealId` opcional
- Buscar primeiro por `contact_id`, se não retornar resultado, buscar por `deal_id`
- Query key inclui ambos os IDs

#### 2. `src/components/relatorios/ControleDiegoDrawer.tsx`
- Passar `dealId` para `useLeadProfile`:
  ```typescript
  const { data: profile, isLoading: loadingProfile } = useLeadProfile(contract?.contactId || null, contract?.dealId || null);
  ```

#### 3. `src/components/crm/LeadProfileSection.tsx`
- Atualizar para também aceitar `dealId` e passá-lo ao hook (manter compatibilidade)

### Arquivos modificados
- `src/hooks/useLeadProfile.ts` — aceitar `dealId`, fallback query
- `src/components/relatorios/ControleDiegoDrawer.tsx` — passar `dealId`
- `src/components/crm/LeadProfileSection.tsx` — passar `dealId` (se disponível)

