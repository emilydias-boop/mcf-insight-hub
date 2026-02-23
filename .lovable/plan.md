
# Consolidar TODAS as Notas do Lead Cross-Pipeline

## Problemas Identificados

### Problema 1: Deals sem `contact_id`
O deal "Matheus Brigatto" no Consorcio (pipeline "Efeito Alavanca + Clube") tem `contact_id = NULL`. Sem esse vinculo, o hook `useContactDealIds` nao consegue encontrar os deals relacionados de outras pipelines.

Dados no banco:
- Inside Sales (`c3254b39`): `contact_id = 40d3a5bb` -- TEM vinculo
- Consorcio (`aeaea21b`): `contact_id = NULL` -- SEM vinculo
- Consorcio replicado (`0b16bbd1`): `contact_id = 40d3a5bb` -- TEM vinculo

Isso afeta **3.311 de 3.743 deals** na pipeline "Efeito Alavanca + Clube" e **299 de 2.293** em "Viver de Aluguel".

### Problema 2: `DealNotesTab` nao busca todas as fontes de notas
O componente atualmente busca apenas:
- `deal_activities` com `activity_type = 'note'` (notas manuais)
- `meeting_slot_attendees.notes` (notas de agendamento do SDR)
- `attendee_notes` (notas do closer)
- `calls.notes` (notas de ligacao)

**Faltam:**
- `deal_activities` com `activity_type = 'qualification_note'` (notas de qualificacao)
- `meeting_slot_attendees.closer_notes` (notas pos-reuniao do closer)

## Solucao

### 1. Fallback por email/telefone no `useContactDealIds`
Quando o deal nao tem `contact_id`, buscar o contato pelo nome do deal ou fazer lookup reverso via `crm_contacts` por email/telefone. Alternativamente, usar `replicated_from_deal_id` para rastrear o deal original.

**Arquivo:** `src/hooks/useContactDealIds.ts`

Logica atualizada:
```text
1. Se tem contactId -> usa direto
2. Se nao, busca contact_id do deal
3. Se contact_id = null, tenta:
   a. Buscar via replicated_from_deal_id (se deal foi replicado)
   b. Buscar contato pelo nome do deal em crm_contacts
4. Com o contact_id resolvido, busca todos os deals
```

### 2. Adicionar `qualification_note` e `closer_notes` no `DealNotesTab`
**Arquivo:** `src/components/crm/DealNotesTab.tsx`

Alteracoes:
- Na query de `deal_activities`, incluir `qualification_note` alem de `note`:
  `.in('activity_type', ['note', 'qualification_note'])`
- Adicionar tipo `qualification` ao `NoteType` e seus estilos/icones
- Buscar `closer_notes` do `meeting_slot_attendees` (campo separado de `notes`)
- Adicionar tipo `closer` ao `NoteType` para notas pos-reuniao

Novos tipos de nota:
- `qualification`: fundo roxo, icone ClipboardList, label "Qualificacao"
- `closer`: fundo indigo, icone UserCheck, label "Pos-Reuniao"

### 3. Corrigir deals existentes sem `contact_id` (migracao de dados)
Para os 3.311 deals sem `contact_id`, criar uma migracao SQL que:
- Busca deals com `replicated_from_deal_id` que tem `contact_id`
- Busca pelo nome do deal em `crm_contacts`
- Atualiza o `contact_id` nos deals orfaos

Isso e feito via migration SQL para corrigir dados historicos.

## Arquivos a Modificar

1. `src/hooks/useContactDealIds.ts` - Adicionar fallback por `replicated_from_deal_id` e nome
2. `src/components/crm/DealNotesTab.tsx` - Adicionar `qualification_note`, `closer_notes`, e novos tipos visuais
3. Migration SQL - Corrigir deals existentes sem `contact_id`

## Resultado Esperado

Ao abrir qualquer deal em qualquer pipeline, o usuario vera:
- Notas manuais de todas as pipelines
- Notas de qualificacao dos SDRs
- Notas pos-reuniao dos Closers
- Notas de agendamento
- Notas de ligacao
- Notas de attendees (reagendamento, etc.)

Tudo consolidado independente de qual pipeline o deal esta.
