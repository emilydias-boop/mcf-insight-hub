
# Consolidar Dados do Lead Across Pipelines

## Problema

Quando um negocio e replicado para outra pipeline (ex: de Inside Sales para Consorcio ou Gerentes de Relacionamento), ele recebe um novo UUID. As abas de Timeline, Notas, Ligacoes e Historico buscam dados usando apenas o `dealUuid` atual, perdendo todas as informacoes coletadas na pipeline original.

O hook `useLeadNotes` ja resolve isso corretamente -- ele busca o `contact_id` do deal atual, encontra TODOS os deals do mesmo contato, e agrega notas de todos eles. Porem os demais componentes nao seguem esse padrao.

## Solucao: Hook utilitario + atualizacao dos componentes

### 1. Criar hook utilitario `useContactDealIds`

Novo arquivo: `src/hooks/useContactDealIds.ts`

Dado um `dealId`, este hook:
- Busca o `contact_id` do deal atual em `crm_deals`
- Busca todos os deals do mesmo contato
- Retorna um array com todos os `deal_id` (UUIDs) relacionados

Isso centraliza a logica de "encontrar todos os deals do mesmo lead" em um unico lugar reutilizavel.

### 2. Atualizar `useLeadFullTimeline.ts` (Timeline)

Atualmente busca atividades, calls, meetings e attendee_notes usando apenas `dealUuid` e `dealId`.

Alteracao:
- Receber `contactId` como parametro adicional (ja disponivel no drawer)
- Buscar todos os deal UUIDs do mesmo contato
- Expandir as queries de `deal_activities`, `calls`, `meeting_slot_attendees` e `attendee_notes` para usar `.in('deal_id', allDealIds)` em vez de `.eq('deal_id', dealUuid)`

### 3. Atualizar `DealNotesTab.tsx` (aba Notas)

Atualmente busca notas manuais, agendamentos, attendee_notes e calls usando apenas `dealUuid`.

Alteracao:
- Receber `contactId` como prop
- Buscar todos os deal IDs do contato
- Expandir todas as queries para usar `.in('deal_id', allDealIds)`

### 4. Atualizar `CallHistorySection.tsx` (aba Ligacoes)

Atualmente busca calls usando `.eq('deal_id', dealId)`.

Alteracao:
- Receber `contactId` como prop (ja existe na interface mas nao e usado para cross-pipeline)
- Buscar todos os deal IDs do contato
- Expandir a query para `.in('deal_id', allDealIds)`

### 5. Atualizar `DealHistory.tsx` (aba Historico)

Atualmente busca `deal_activities` usando apenas `dealUuid` e `dealId`.

Alteracao:
- Receber `contactId` como prop
- Buscar todos os deal IDs do contato
- Expandir a query para buscar atividades de todos os deals relacionados

### 6. Atualizar `DealDetailsDrawer.tsx`

Passar `contactId` (de `deal.contact_id`) como prop para todos os componentes atualizados:
- `LeadFullTimeline` (ja recebe `contactEmail`, adicionar `contactId`)
- `DealNotesTab` (adicionar `contactId`)
- `CallHistorySection` (ja tem `contactId` na interface, passar o valor correto)
- `DealHistory` (adicionar `contactId`)

## Detalhes Tecnicos

**Hook `useContactDealIds` (pseudo-codigo):**
```text
function useContactDealIds(dealId):
  query = useQuery(['contact-deal-ids', dealId]):
    1. SELECT contact_id FROM crm_deals WHERE id = dealId
    2. SELECT id FROM crm_deals WHERE contact_id = contact_id
    3. return array de UUIDs
  return { allDealIds, isLoading }
```

**Padrao de uso nos componentes:**
```text
// Antes:
.eq('deal_id', dealUuid)

// Depois:
.in('deal_id', allDealIds)
```

**Arquivos a criar:**
1. `src/hooks/useContactDealIds.ts`

**Arquivos a modificar:**
1. `src/hooks/useLeadFullTimeline.ts`
2. `src/components/crm/DealNotesTab.tsx`
3. `src/components/crm/CallHistorySection.tsx`
4. `src/components/crm/DealHistory.tsx`
5. `src/components/crm/DealDetailsDrawer.tsx`

## Resultado Esperado

Ao abrir qualquer deal de "Matheus Brigatto" em qualquer pipeline (Inside Sales, Consorcio, Gerentes de Relacionamento), o usuario vera:
- Todas as notas de qualificacao escritas pelos SDRs
- Todas as notas dos Closers de R1 e R2
- Todas as ligacoes feitas em qualquer pipeline
- Todo o historico de movimentacoes de estagio
- Toda a timeline unificada com eventos de todas as pipelines
