
# Distribuição Automática de Leads Outside

## Contexto

O problema atual: leads "Outside" (que pagaram um contrato mas ainda não fizeram R1) ficam sem dono no Kanban e dependem da gestora para distribuição manual. A solução deve distribuir automaticamente esses deals usando a fila de distribuição já existente (`get_next_lead_owner`).

## Origem do Problema

Existem dois momentos em que um lead vira "Outside":

1. **Pagamento de contrato (Hubla webhook)** - Quando a Hubla notifica um novo contrato pago, o `hubla-webhook-handler` chama `autoMarkContractPaid()`. Esta função tenta encontrar um attendee R1 para o email. Se NÃO encontra attendee (outside), ela simplesmente retorna `return` sem fazer nada com o deal existente no Kanban. O deal fica sem owner.

2. **Leads históricos** - Deals que já existem no banco mas cujo contato pagou um contrato e nunca teve R1. Esses precisam ser detectados e distribuídos em batch.

## Solução

### Parte 1 - Nova Edge Function: `distribute-outside-leads`

Criar uma nova edge function que:
1. Busca todos os deals na origin `e3c04f21` (PIPELINE INSIDE SALES) que estão sem owner (`owner_id IS NULL`) OU com owner mas que são Outside
2. Para cada deal Outside sem owner, usa `get_next_lead_owner` para atribuir automaticamente
3. Atualiza `owner_id` + `owner_profile_id` + registra atividade em `deal_activities`
4. Suporta `dry_run` para testar sem alterar dados

A detecção de "Outside" na edge function:
- Busca `hubla_transactions` com `product_name ILIKE '%Contrato%'` e `sale_status = 'completed'` para emails dos deals
- Busca `meeting_slot_attendees` + `meeting_slots` com `meeting_type = 'r1'` para os deal_ids
- Outside = tem contrato E (sem R1 OU contrato pago antes/na data da R1)

### Parte 2 - Modificar `hubla-webhook-handler` (função `autoMarkContractPaid`)

Atualmente, quando `autoMarkContractPaid` não encontra attendee R1 (fluxo Outside), ela retorna sem fazer nada. A melhoria: após falhar no match, buscar o deal no CRM pelo email do contato e, se o deal estiver sem owner, chamar `get_next_lead_owner` para atribuí-lo automaticamente.

Lógica adicional no `autoMarkContractPaid` após o bloco "Nenhum match encontrado":

```
// No attendee found = possible Outside lead
// Find the deal for this contact and auto-distribute if no owner
deal = find deal by email in origin PIPELINE INSIDE SALES
if (deal exists AND deal.owner_id IS NULL):
  newOwner = get_next_lead_owner(origin_id)
  update deal.owner_id = newOwner
  update deal.owner_profile_id = profile_id of newOwner
  insert deal_activities (type: owner_change, description: "Auto-distribuído como lead Outside")
  add tag "Outside" to deal
```

### Parte 3 - UI: Botão "Distribuir Outsides" no Kanban

Adicionar um botão na barra de ações do Kanban (visível apenas para admin/manager) que chama a nova edge function. Mostra resultados: quantos foram distribuídos, para quem, etc.

Este botão aparece como um ícone de distribuição na barra de filtros ou cabeçalho, e abre um dialog de confirmação com `dry_run` opcional.

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/functions/distribute-outside-leads/index.ts` | Novo | Edge function para distribuição em batch de outsides |
| `supabase/functions/hubla-webhook-handler/index.ts` | Editar | Auto-distribuir no webhook quando nenhum attendee R1 é encontrado |
| `src/components/crm/OutsideDistributionButton.tsx` | Novo | Botão UI para acionar distribuição manual em batch |
| `src/pages/crm/Negocios.tsx` | Editar | Incluir botão OutsideDistribution na barra de ações (apenas admin/manager) |

## Detalhes Técnicos

### Edge Function `distribute-outside-leads`

Parâmetros de entrada (JSON body):
- `dry_run?: boolean` - Se true, apenas simula sem alterar dados
- `origin_id?: string` - Específico para uma origin (default: PIPELINE INSIDE SALES)
- `only_no_owner?: boolean` - Se true, só distribui deals sem owner (default: true)

Lógica:
1. Buscar deals da origin sem owner
2. Buscar emails dos contatos desses deals
3. Verificar quais têm contrato pago em `hubla_transactions`
4. Verificar quais NÃO têm R1 em `meeting_slot_attendees`
5. Para cada Outside confirmado: chamar `get_next_lead_owner`, atualizar deal, registrar atividade

### Webhook Auto-distribuição

No `hubla-webhook-handler`, na função `autoMarkContractPaid`, após o bloco que faz `return` quando não encontra attendee R1, adicionar:

```typescript
// Outside lead: buscar deal e distribuir automaticamente
const { data: outsideDeal } = await supabase
  .from('crm_deals')
  .select('id, owner_id, origin_id, tags')
  .eq('contact_id', contactId) // ou by email join
  .is('owner_id', null)
  .limit(1)
  .maybeSingle();

if (outsideDeal) {
  const { data: nextOwner } = await supabase.rpc('get_next_lead_owner', { 
    p_origin_id: outsideDeal.origin_id 
  });
  // atualizar deal + activity
}
```

## Fluxo Após a Implementação

```text
Hubla paga contrato
      ↓
hubla-webhook-handler
      ↓
autoMarkContractPaid()
      ↓
  Tem R1? ──YES──> Marcar contrato_pago, transferir para closer
      │
      NO (= Outside)
      ↓
  Tem deal sem owner?──YES──> get_next_lead_owner → atribuir SDR automaticamente
      │                         + tag "Outside" + atividade registrada
      NO
      ↓
    Ignorar (lead com owner já tem responsável)
```

Gestores também podem acionar a distribuição em batch via botão na UI para tratar histórico acumulado.
