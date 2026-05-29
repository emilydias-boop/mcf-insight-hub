## Causa raiz

O lead "Thiago" foi criado pela origem Hubla com dados incompletos:
- `crm_contacts.name = "Thiago"` (sem sobrenome)
- `crm_contacts.email = NULL`
- `crm_contacts.phone = "12 99104-3714"` (com espaços/traços, quebra o filtro de telefone que normaliza só a query)
- `crm_deals.name = "Thiago"`

Os dados completos do comprador estão em `hubla_transactions` (id `fbab2806…`):
- `customer_name = "Thiago Teixeira Clemente"`
- `customer_email = "tec.consultoria@icloud.com"`
- `customer_phone = "+5512991043714"`
- `customer_document = "46679287863"`

A busca da R2 (`useSearchDealsForSchedule`) procura por nome do deal, nome/email/telefone do contato — nenhum desses bate com "Thiago Teixeira Clemente" ou "tec.consultoria@icloud.com". Por isso os closers não acham.

## Escopo aprovado

1. **Corrigir só este lead agora** (sem varredura retroativa).
2. **Sync automático Hubla → contato CRM** quando o contrato for pago, para não acontecer de novo.

Tudo é backend/DB. Sem mudança de UI.

---

## 1) Migração one-off — corrigir o lead Thiago

UPDATE direto nas 3 tabelas (mesma migração):

- `crm_contacts` id `00570c09-9f84-47d2-b4e2-bb1131d17604`
  - `name` → `"Thiago Teixeira Clemente"`
  - `email` → `"tec.consultoria@icloud.com"`
  - `phone` → `"+5512991043714"`
- `crm_deals` id `98be16be-8bd9-416f-95a3-af6599fa3851`
  - `name` → `"Thiago Teixeira Clemente"`
- `meeting_slot_attendees` id `167adfae-c5f2-47c1-affb-eea61862448d`
  - `attendee_name` → `"Thiago Teixeira Clemente"`
  - `attendee_phone` → `"+5512991043714"`
- `hubla_transactions` id `fbab2806-ed7a-4dd9-81a5-8f29acc300e5`
  - `linked_deal_id` → `98be16be-…` (estava `NULL`; já tem o `linked_attendee_id`, mas linkar no deal também ajuda buscas/relatórios)

Depois disso, qualquer closer encontra o lead buscando por "Thiago Teixeira Clemente", "Clemente", "tec.consultoria" ou pelo telefone `12991043714`.

---

## 2) Sync automático Hubla → contato CRM (prevenção)

Trigger de banco que enriquece o contato/deal/attendee assim que a venda for vinculada e marcada como paga.

**Função `public.sync_hubla_buyer_to_crm(p_attendee_id uuid)`** (`SECURITY DEFINER`, `search_path = public`):

1. Buscar o último `hubla_transactions` com `linked_attendee_id = p_attendee_id` e `sale_status = 'completed'`.
2. Se não existir, sair sem erro.
3. Resolver o `attendee` (que dá `deal_id` e `contact_id`).
4. **Regra de enriquecimento (só preenche se o valor atual estiver vazio ou for menor / mais curto):**
   - `crm_contacts.name`: substituir se atual for `NULL`, vazio, ou tiver menos palavras que `customer_name`.
   - `crm_contacts.email`: substituir só se atual for `NULL`/vazio.
   - `crm_contacts.phone`: substituir só se atual for `NULL`/vazio, OU se a versão normalizada (`regexp_replace(phone, '\D', '', 'g')`) tiver menos de 10 dígitos. Sempre gravar no formato Hubla (`+55…`).
   - `crm_deals.name`: substituir se atual for `NULL`, vazio, ou tiver menos palavras que `customer_name`.
   - `meeting_slot_attendees.attendee_name/attendee_phone`: substituir se vazio/menor.
   - `hubla_transactions.linked_deal_id`: setar se ainda for `NULL`.
5. Nunca sobrescreve dado já completo (segurança contra Hubla retornar nome menor em algum payload).

**Trigger 1 — em `meeting_slot_attendees`:**
`AFTER UPDATE OF status, contract_paid_at` quando `NEW.status = 'contract_paid'` ou `NEW.contract_paid_at IS NOT NULL` e o anterior estava diferente → chama `sync_hubla_buyer_to_crm(NEW.id)`.

**Trigger 2 — em `hubla_transactions`:**
`AFTER INSERT OR UPDATE OF linked_attendee_id, sale_status` quando `NEW.linked_attendee_id IS NOT NULL` e `NEW.sale_status = 'completed'` → chama `sync_hubla_buyer_to_crm(NEW.linked_attendee_id)`.

Assim, tanto faz quem vier primeiro (vincular contrato OU marcar contrato pago), o contato/deal são enriquecidos automaticamente e a busca de R2 funciona.

---

## Detalhes técnicos

- **Tabelas afetadas:** `crm_contacts`, `crm_deals`, `meeting_slot_attendees`, `hubla_transactions` (só `UPDATE` de dados; sem novas colunas, sem mudança de RLS, sem mudança de GRANTs).
- **Função nova:** `public.sync_hubla_buyer_to_crm(uuid)` — `SECURITY DEFINER`, `search_path = public`.
- **Triggers novos:** `trg_attendee_sync_hubla_buyer` em `meeting_slot_attendees` e `trg_hubla_sync_buyer` em `hubla_transactions`.
- **Sem mudanças no frontend** (a busca da R2 já cobre nome/email/telefone — basta os dados existirem).
- **Sem impacto em métricas:** o sync só completa campos vazios; não altera `stage`, `status`, `owner`, `origin`.
- **Memória a salvar depois:** novo arquivo `mem://integration/hubla-buyer-to-crm-sync` documentando a regra "Hubla completed + attendee vinculado → enriquece contato/deal/attendee, só quando o campo CRM está vazio ou mais curto".

## Validação após aplicar

1. Confirmar via SQL que `crm_contacts` / `crm_deals` / `meeting_slot_attendees` do Thiago ficaram com nome/email/telefone corretos.
2. No preview, abrir o modal "Agendar R2", buscar por "Clemente", "tec.consultoria" e "12991043714" — o lead deve aparecer nos três.
3. Forçar um `UPDATE` de teste em outro attendee `contract_paid` para confirmar que o trigger preenche campos vazios sem sobrescrever os já preenchidos (rollback do teste depois).
