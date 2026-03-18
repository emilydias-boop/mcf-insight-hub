

## Plano: Proteger leads com reunião na importação de planilha

### Resumo

Leads que já tiveram reunião (R1/R2) devem ser protegidos durante a importação: **não mover de stage** e **não trocar owner** — apenas adicionar as tags.

### Mudanças

#### 1. Edge Function `import-spreadsheet-leads/index.ts` (linhas 133-153)

Antes de atualizar um deal existente, verificar se tem reunião em `meeting_slots`:

```typescript
if (existingDeal?.length) {
  const { data: meetings } = await supabase
    .from('meeting_slots')
    .select('id')
    .eq('deal_id', existingDeal[0].id)
    .limit(1);

  const hasMeetings = meetings && meetings.length > 0;

  if (hasMeetings) {
    // Só atualiza tags
    const updateData: any = { tags: finalTags };
    await supabase.from('crm_deals').update(updateData).eq('id', existingDeal[0].id);
    updated++;
  } else {
    // Atualiza stage, owner, tags normalmente
    const updateData: any = { stage_id: firstStageId, tags: finalTags };
    if (owner_email) updateData.owner_id = owner_email;
    if (owner_profile_id) updateData.owner_profile_id = owner_profile_id;
    await supabase.from('crm_deals').update(updateData).eq('id', existingDeal[0].id);
    updated++;
  }
  continue;
}
```

#### 2. Frontend `SpreadsheetCompareDialog.tsx` (linhas 340-386)

Separar deals `found_in_current` em dois grupos antes de processar:

- **Com reunião** → só atualizar tags (sem transfer de owner, sem mudança de stage)
- **Sem reunião** → fluxo normal (transfer + stage + tags)

```typescript
// Buscar quais deals têm reunião
const allDealIds = inCurrent.map(r => r.localDealId!);
const { data: dealsWithMeetings } = await supabase
  .from('meeting_slots')
  .select('deal_id')
  .in('deal_id', allDealIds);

const meetingDealIds = new Set(dealsWithMeetings?.map(m => m.deal_id) || []);
const withMeeting = inCurrent.filter(r => meetingDealIds.has(r.localDealId!));
const withoutMeeting = inCurrent.filter(r => !meetingDealIds.has(r.localDealId!));

// Com reunião: só tags
if (withMeeting.length > 0 && tags?.length) {
  await supabase.from('crm_deals')
    .update({ tags: [...new Set(['base clint', ...tags])] })
    .in('id', withMeeting.map(r => r.localDealId!));
}

// Sem reunião: transfer + stage + tags (fluxo existente)
// ... usar withoutMeeting no lugar de inCurrent
```

Toast informativo: `"X leads com reunião mantidos (apenas tags atualizadas)"`

#### 3. Reverter deals movidos incorretamente

Query SQL para identificar deals que têm reunião mas foram movidos pela importação recente, e revertê-los ao stage anterior usando `deal_activities.from_stage`.

### Resultado

- Leads com reunião: apenas tags atualizadas, stage e owner preservados
- Leads sem reunião: fluxo normal (stage + owner + tags)
- Toast informando quantos leads foram protegidos

