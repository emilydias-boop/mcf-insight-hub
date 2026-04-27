---
name: CRM Contact Duplicate Prevention
description: Trigger BEFORE INSERT em crm_contacts usa pg_advisory_xact_lock por email/phone9 e bloqueia duplicação ativa lançando unique_violation 'duplicate_contact:<key>:<existing_id>'.
type: feature
---
A tabela `public.crm_contacts` tem o trigger `trg_prevent_duplicate_crm_contact` (BEFORE INSERT) que serializa inserts concorrentes com a mesma chave (email normalizado e/ou últimos 9 dígitos do telefone) via `pg_advisory_xact_lock`, e checa se já existe contato ativo (não arquivado e não mesclado) com aquela chave. Se existir, levanta `unique_violation` com mensagem `duplicate_contact:email:<email>:<existing_id>` ou `duplicate_contact:phone:<phone9>:<existing_id>`.

Edge functions de ingestão (webhook-lead-receiver, hubla-webhook-handler, webhook-live-leads, webhook-sdr-leads, etc.) devem capturar esse erro e reaproveitar o `existing_id` em vez de tentar criar novo contato. Isso elimina a janela de race condition (~100-200ms entre webhooks duplicados do Clint/Hubla) que estava criando 2-8 contatos para o mesmo lead.

**Why:** Sem o trigger, check-then-insert na aplicação não protege contra inserts simultâneos. Tabela tinha 2.715 grupos duplicados por email e 3.194 por telefone.
