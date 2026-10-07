# Verificação (somente leitura): 2ª proposta no mesmo negócio (Edson, deal 96222fb2)

Nenhum arquivo ou dado foi alterado. Este card apenas registra o resultado; não há implementação a aprovar.

## 1) Regras de unicidade no banco
- consorcio_proposals, consorcio_proposal_cartas, consorcio_pending_registrations: única regra de unicidade é a chave primária `id`. Não existe UNIQUE, índice único ou exclusion por deal_id, contact_id ou cpf.
- A única regra "um por" no caminho é `consorcio_venda_webhook_queue ON CONFLICT (venda_id)` — por proposta, não por negócio.

## 2) Checagens no código
- `useEnviarProposta` (src/hooks/useConsorcioPostMeeting.ts:736-748): sempre `insert` novo em consorcio_proposals; cartas com `insert` (752-770). Não há upsert, nem update por deal_id, nem bloqueio "já existe proposta".
- `ProposalModal.tsx:76-84`: chama o insert; 86-110 cria cadastro pendente com o `proposal_id` NOVO.
- `useCreatePendingRegistration` (useConsorcioPendingRegistrations.ts:496-502): a trava de duplicidade filtra por `proposal_id` (o novo), não pelo negócio. Update de status 'aceita' (552-560) é `.eq('id', input.proposal_id)` novo; update da carta (565-567) é `.eq('id', carta_id)` nova.

## 3) Efeitos além do INSERT
- Etapa do negócio: se origem VdA, update `crm_deals.stage_id = Proposta Enviada` (useConsorcioPostMeeting.ts:775-778). Ao criar cadastro, trigger `trg_consorcio_stage_cota` → `consorcio_sincronizar_stage_cota(deal)`: só age na origem Efeito Alavanca+Clube e só move uma vez; se o negócio já tem backup em cota_contratada_stage_anterior, retorna 'ja_movido' (não move).
- Cadastro pendente: sim, se algum campo do cliente for preenchido — linha nova.
- Triggers: auditoria (insert em audit_logs), `trg_sync_proposal_cartas_agregado` (update só `WHERE id = proposal_id da carta` — a nova), validação de carta (prazo/crédito/produto > 0, prazo 100 passa), vendedor padrão (só NEW).
- `enqueue_consorcio_venda_webhook`: ao virar 'aceita', 1 linha nova na fila (venda_id novo) → `consorcio-venda-webhook-dispatcher` só faz SELECT em propostas/cartas/cadastros/deal/attendees e UPDATE apenas na própria fila. Alerta de venda novo será disparado (comportamento normal).
- `consorcio-carta-cadastrada-webhook`: só SELECT por card_id/proposal_id/id + insert em bu_webhook_logs.

## Conclusão
Nenhum caminho faz UPDATE na proposta antiga 67d2a1ec nem no cadastro antigo c9838af8. A 2ª proposta grava de ponta a ponta. Ressalva: não testado com gravação real (regra zero).
