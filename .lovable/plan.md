

## Corrigir Outside falso-positivo em R2 Agendada

### Problema raiz
A busca de reunioes R1 em `useOutsideDetectionForDeals.ts` usa apenas o `deal_id` atual. Quando deals sao movidos entre pipelines (ex: pipeline original → PIPELINE INSIDE SALES), o deal ganha um novo ID mas a reuniao R1 continua vinculada ao deal antigo. Resultado: 0 R1s encontradas → todos marcados como Outside.

Dados confirmam: 10/10 deals em R2 Agendada tem `r1_count = 0` e `earliest_r1 = null`, apesar de terem passado por R1 no fluxo normal.

### Solucao

**`src/hooks/useOutsideDetectionForDeals.ts`** -- busca de R1 por email alem de deal_id

1. **Adicionar busca de R1 por email**: Alem da busca por `deal_id` (que cobre o caso normal), fazer uma segunda busca de R1 meetings por email do contato. Isso pega R1s que foram feitas em deals de outras pipelines.

2. **Mesclar resultados**: Para cada deal, usar o `earliestR1` de qualquer uma das fontes (por deal_id OU por email do contato). Se qualquer uma encontrar R1, usar a data mais antiga.

Concretamente, na query paralela (passo 3), adicionar:

```typescript
// R1 meetings by contact email (cross-pipeline)
batchedIn<{ email: string; scheduled_at: string }>(
  (chunk) =>
    supabase
      .from('meeting_slot_attendees')
      .select('deal:crm_deals!inner(contact:crm_contacts!inner(email)), meeting_slots!inner(scheduled_at, meeting_type)')
      .in('deal.contact.email', chunk)  // NOTE: may need alternative approach
      .eq('meeting_slots.meeting_type', 'r1'),
  uniqueEmails
)
```

**Abordagem alternativa mais simples**: Como a join aninhada pode ser complexa no Supabase, buscar todos os `deal_id`s do mesmo contato primeiro, depois usar esses deal_ids na busca de R1:

- Step 2b: Para cada email, buscar todos os deal_ids associados via `crm_deals.contact_id → crm_contacts.email`
- Usar o conjunto expandido de deal_ids na busca de R1 (que ja existe)

No passo 5 (build earliestR1), mapear os resultados de volta para o deal original usando o mapa email→dealIds.

### Alteracao concreta

**`src/hooks/useOutsideDetectionForDeals.ts`**:

1. Antes das queries paralelas, buscar TODOS deal_ids por email:
```typescript
const allDealsForEmails = await batchedIn(
  (chunk) => supabase.from('crm_deals')
    .select('id, crm_contacts!inner(email)')
    .in('crm_contacts.email', chunk),
  uniqueEmails
);
// Build emailToAllDealIds map
```

2. Expandir a lista de dealIds para a busca de R1 para incluir todos os deals do mesmo contato

3. No passo 5, ao construir `earliestR1`, mapear R1s encontradas em deals "irmaos" de volta para os deals atuais usando o mapa de email

### Resultado
- Deals em R2 Agendada que passaram por R1 em outra pipeline NAO serao marcados como Outside
- Deals genuinamente Outside (contrato antes de qualquer R1 em qualquer pipeline) continuam sendo detectados
- Sem impacto em performance significativo (uma query extra de deals por email)

