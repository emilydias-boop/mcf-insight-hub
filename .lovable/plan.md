
## Diagnóstico

O problema mais provável não é o Kanban em si: é que existem dois caminhos de merge com comportamentos diferentes.

### O que encontrei no código

1. A Edge Function `supabase/functions/merge-duplicate-contacts/index.ts` já tem a lógica nova de:
   - priorizar deal mais avançado por `stage_order`
   - consolidar deals duplicados na mesma `origin`
   - transferir `meeting_slots`, `meeting_slot_attendees`, `deal_activities` e `calls`
   - deletar o deal secundário

2. Porém o botão de merge individual da tela de duplicados **não usa essa Edge Function**.
   Em `src/hooks/useDuplicateContacts.ts`, o `useMergeDuplicates()` faz apenas:
   - `UPDATE crm_deals SET contact_id = primaryId`
   - `DELETE crm_contacts` duplicados

   Ou seja: ele junta os contatos, mas **não consolida os 2 deals da mesma pipeline**.

3. Além disso, a listagem de duplicados no frontend ainda ordena o “principal” por:
   - mais deals
   - mais reuniões
   - mais antigo

   enquanto o backend novo escolhe por:
   - maior `stage_order`
   - depois deals/reuniões/antiguidade

   Então a UI pode sugerir um “principal” diferente do que a regra correta deveria manter.

## Causa raiz provável do que você está vendo

O lead ficou com 2 deals porque ele foi unificado por um fluxo que só moveu `contact_id`, mas não executou a etapa de consolidação por pipeline.

Em outras palavras:
- os contatos podem já estar unidos
- mas os dois negócios na mesma `origin_id` permaneceram ativos

## Plano de correção

### 1. Unificar a lógica de merge no backend
Alterar o fluxo para que o merge individual também passe pela mesma lógica server-side da Edge Function, em vez de fazer merge “local” no frontend.

Implementação proposta:
- estender `merge-duplicate-contacts` para aceitar merge direcionado de um grupo específico:
  - `primary_id`
  - `duplicate_ids`
  - opcionalmente `dry_run`
- reaproveitar a mesma função `mergeContacts(...)` já existente no backend

Resultado:
- “Unificar” e “Unificar Todos” passam a ter o mesmo comportamento seguro

### 2. Corrigir o hook `useMergeDuplicates`
Trocar a implementação atual de `useMergeDuplicates()` para chamar a Edge Function, e não mais fazer:
- update de `crm_deals.contact_id`
- delete de `crm_contacts`
diretamente do browser

Isso elimina o caminho incompleto que hoje deixa 2 deals do mesmo lead.

### 3. Alinhar a ordenação da tela com a regra real
Atualizar `useDuplicateContacts` para ordenar os contatos usando o mesmo critério do backend:
- maior `stage_order`
- mais deals
- mais reuniões
- mais antigo

Isso evita que a UI marque como “Principal” um contato/deal menos avançado.

### 4. Melhorar o retorno do merge para auditoria
Fazer a Edge Function devolver no `groups_processed`:
- `primary_deal_id`
- `secondary_deal_ids`
- `deals_consolidated`
- `origin_ids_afetadas`

Assim a tela consegue mostrar com clareza que, além do contato, os negócios da mesma pipeline também foram consolidados.

### 5. Tratar os casos já existentes
Depois da correção, executar novamente o merge do par afetado para forçar a consolidação dos deals já existentes.
Se necessário, usar primeiro `dry_run` para validar:
- qual deal ficará como principal
- quais relacionamentos serão transferidos
- quantos deals serão consolidados

## Arquivos a alterar

- `src/hooks/useDuplicateContacts.ts`
  - substituir `useMergeDuplicates()` por chamada à Edge Function
  - alinhar ordenação dos grupos com `stage_order`

- `supabase/functions/merge-duplicate-contacts/index.ts`
  - aceitar merge direcionado (`primary_id`, `duplicate_ids`)
  - reaproveitar a consolidação já existente para merge individual
  - enriquecer payload de retorno

- opcionalmente `src/pages/crm/ContatosDuplicados.tsx`
  - ajustar textos/feedback para deixar explícito que o merge também consolida deals da mesma pipeline

## Resultado esperado

Depois dessa correção:
- não haverá mais diferença entre “Unificar” e “Unificar Todos”
- um lead duplicado na mesma pipeline terminará com:
  - 1 contato
  - 1 deal por pipeline
  - reuniões, attendees, atividades e calls preservados no deal mantido

## Observação importante

Pelo código atual, o cenário que você descreveu é totalmente consistente com um merge individual já executado pelo fluxo antigo.
Ou seja: a correção principal agora não é no Kanban, e sim em eliminar esse caminho incompleto de merge no frontend.
