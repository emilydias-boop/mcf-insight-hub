

## Limpeza de duplicados do Consórcio via SQL

### Escala (apenas Consórcio)
- **20 grupos** de contatos duplicados por email
- **43 grupos** de contatos duplicados por telefone
- **72 pares** de deals duplicados (mesmo contact_id + origin_id)

### Plano: Migration SQL com procedure focada no Consórcio

Criar uma função PL/pgSQL `merge_consorcio_duplicates()` que executa 3 etapas:

**Etapa 1 — Merge contatos por email (Consórcio only)**
- Identifica contatos com mesmo email que possuem deals nas origins Consórcio (`4e2b810a...` e `7d7b1cb5...`)
- Elege primário (maior stage_order > mais deals > mais antigo)
- Transfere FKs de 14 tabelas dependentes (incluindo `meeting_slot_attendees` e `whatsapp_conversations` que são NO ACTION — precisam UPDATE explícito antes do DELETE)
- Enriquece primário com phone/email faltante
- Deleta duplicados

**Etapa 2 — Merge contatos por telefone (sufixo 9 dígitos, Consórcio only)**
- Mesma lógica, agrupando por últimos 9 dígitos do telefone
- Filtra apenas contatos com deals no Consórcio

**Etapa 3 — Consolidar deals duplicados na mesma origin**
- Para cada par (contact_id + origin_id) no Consórcio com 2+ deals
- Mantém o deal mais avançado (maior stage_order)
- Transfere `meeting_slots`, `meeting_slot_attendees`, `deal_activities`, `calls`, `deal_tasks`, `deal_produtos_adquiridos`, `consorcio_pending_registrations`, `consorcio_proposals` do secundário para o primário
- Deleta deal secundário

### Tabelas com FK para crm_contacts (todas tratadas)
| Tabela | Delete Rule | Ação |
|--------|-------------|------|
| crm_deals | SET NULL | UPDATE contact_id |
| calls | SET NULL | UPDATE contact_id |
| meeting_slots | SET NULL | UPDATE contact_id |
| meeting_slot_attendees | **NO ACTION** | UPDATE antes do DELETE |
| whatsapp_conversations | **NO ACTION** | UPDATE antes do DELETE |
| lead_profiles | CASCADE | UPDATE contact_id |
| automation_blacklist | CASCADE | UPDATE contact_id |
| automation_queue | CASCADE | UPDATE contact_id |
| automation_logs | SET NULL | UPDATE contact_id |
| billing_subscriptions | SET NULL | UPDATE contact_id |
| deal_tasks | SET NULL | UPDATE contact_id |
| encaixe_queue | SET NULL | UPDATE contact_id |
| gr_wallet_entries | SET NULL | UPDATE contact_id |
| partner_returns | SET NULL | UPDATE contact_id |

### Arquivo
- Nova migration SQL — `merge_consorcio_duplicates()` + execução + drop

### Resultado esperado
- ~63 grupos de contatos unificados
- ~72 pares de deals consolidados
- Dados de reuniões, atividades e ligações preservados no registro primário

