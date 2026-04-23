

## Saneamento dos leads duplicados — manter o deal mais avançado

### Resumo

Consolidar contatos e deals duplicados existentes no CRM. Para cada grupo de duplicados, eleger o registro canônico, migrar todo o histórico (atividades, tarefas, reuniões, vendas) e arquivar os secundários sem perder dados.

### Critério de eleição

**Contato canônico** (por grupo de identidade — mesmo email lowercase OU mesmo sufixo de 9 dígitos do telefone):
1. Mais antigo (`created_at` mais cedo)
2. Em empate, o que tem mais campos preenchidos (email + telefone + nome)
3. Em empate final, o com mais relacionamentos

**Deal canônico** (após remap, quando sobrarem 2+ deals no mesmo `contact_id` + `origin_id`):
1. Estágio mais avançado (maior `stage_order` da tabela `crm_stages`)
2. Em empate de estágio, o mais antigo

### Etapas

**1. Migration de schema**

Adicionar em `crm_deals` colunas de auditoria de merge:
- `merged_into_deal_id uuid references crm_deals(id)`
- `merged_at timestamptz`
- `is_archived boolean default false`
- Índice parcial `(contact_id, origin_id) where is_archived = false` para acelerar queries do Kanban

**2. Atualizar `merge-duplicate-contacts`**

A função hoje já remapeia `crm_deals.contact_id` e `meeting_slot_attendees.contact_id` e arquiva contatos secundários. Adicionar passo final:

Para cada `(contact_id, origin_id)` com 2+ deals ativos após remap:
- Eleger principal (maior `stage_order`, depois mais antigo)
- Mover para o deal principal: `deal_activities`, `deal_tasks`, `meeting_slots`, `calls`, `consorcio_pending_registrations`, `automation_queue`, `automation_logs`, `attendee_notes` (atualizar `deal_id`)
- Registrar uma `deal_activities` no principal: "Mesclado a partir do deal {id} em {data}"
- Arquivar secundário: `is_archived = true`, `merged_into_deal_id = principal`, `merged_at = now()`

Retornar relatório completo: contatos arquivados, deals remapeados, deals arquivados, atividades movidas, erros.

**3. Filtrar arquivados no frontend**

Adicionar `.eq('is_archived', false)` (ou `.or('is_archived.is.null,is_archived.eq.false')`) em:
- `src/hooks/useCRMData.ts` — Kanban principal
- `src/hooks/useContactDeals.ts` — deals do contato
- `src/hooks/useContactDealIds.ts` — resolução de IDs
- `src/hooks/useContactsEnriched.ts` — listagem enriquecida
- `src/hooks/useTeamMeetingsData.ts` e RPCs de relatório que contam deals (revisar e ajustar onde fizer sentido)

**4. Execução do saneamento**

Em duas chamadas da edge function `merge-duplicate-contacts`:
1. **Dry-run** (`dry_run: true, batch_size: 200`): retorna o relatório do que será mesclado. Reviso os números com você antes de aplicar.
2. **Execução** (`dry_run: false, batch_size: 100`): aplica em lotes para não sobrecarregar o banco.

### Comportamento esperado após saneamento

| Caso | Antes | Depois |
|---|---|---|
| Stéphanne (2 contatos + 2 deals na Inside Sales) | duplicado | 1 contato + 1 deal (o mais avançado), histórico unificado |
| Lead com deal R1 Agendada + deal Contrato Pago duplicado | 2 deals | 1 deal Contrato Pago, atividades do R1 migradas |
| Contato com email igual em pipelines diferentes (Incorp + Crédito) | 2 contatos | 1 contato, 2 deals (um em cada pipeline — não são duplicados de pipeline) |
| Métricas de Reuniões/Carrinho/Closing | infladas | leve queda esperada (= duplicação removida) |

### Validação pós-execução

1. Buscar Stéphanne → 1 contato ativo, 1 deal ativo na Inside Sales, histórico completo (R1, ligações, venda).
2. Query: contar grupos de contatos ativos com mesma identidade → 0.
3. Query: contar `(contact_id, origin_id)` com 2+ deals ativos → 0.
4. Conferir Alexandre, Fábio e Clerismar (casos confirmados).
5. Verificar `deal_activities` do deal canônico contém entrada "Mesclado a partir de…" para rastreabilidade.

### Arquivos afetados

- **Migration**: `crm_deals` (colunas de merge + índice).
- `supabase/functions/merge-duplicate-contacts/index.ts`: passo de consolidação de deals + relatório expandido.
- `src/hooks/useCRMData.ts`, `src/hooks/useContactDeals.ts`, `src/hooks/useContactDealIds.ts`, `src/hooks/useContactsEnriched.ts`: filtro `is_archived`.
- (Sem mudanças no `hubla-webhook-handler` — já corrigido na etapa anterior.)

### Reversibilidade

Nada é deletado. Contatos e deals secundários ficam com `is_archived = true` + ponteiros `merged_into_*`. Se algum merge precisar ser revertido, é possível desarquivar e remapear de volta usando os campos de auditoria.

