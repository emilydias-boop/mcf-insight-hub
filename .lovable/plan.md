## Contexto

Lead `joraju2004@yahoo.com.br` (Josias Rabelo Junior) comprou Contrato pelo **link pessoal do William** (oferta `Contrato CLS - WF Caução 497`). O linker automático Hubla vinculou a venda ao R1 do **Julio** (slot manual de 06/05 13:30 UTC), e como o pagamento (06:06 UTC) é anterior, virou Outside e sumiu de todos os painéis.

## Decisão

Reatribuir a venda ao William **sem deixar histórico de R1 no Julio** (o R1 do Julio será removido como se nunca tivesse sido agendado, pois na prática ele não fazia parte do fluxo dessa venda).

## O que fazer

1. **Criar slot novo do William** — `meeting_slots` com `closer_id=William`, `scheduled_at='2026-05-06 06:06:08+00'`, `status='completed'`, `meeting_type='r1'`, `source='manual'`, nota explicando reconciliação.

2. **Criar attendee novo do William** — `meeting_slot_attendees` ligado ao novo slot, com `deal_id` do Josias, `status='contract_paid'`, `contract_paid_at='2026-05-06 06:06:08.794+00'`, `is_partner=false`.

3. **Religar a transação Hubla** — `hubla_transactions` `e54c677c-...` aponta `linked_attendee_id` para o novo attendee, `linked_method='manual'`.

4. **Remover R1 do Julio (sem deixar rastro de no-show)**:
   - DELETE no attendee `4c77deba-0312-438d-9eb8-468184450980` (Josias no slot do Julio).
   - DELETE no slot `c8e3f9f6-88c5-4a97-a427-dcbe167edbc0` (R1 do Julio das 13:30) — confirmado que esse slot só tinha esse 1 attendee, é manual (sem Calendly/Google sync), portanto seguro remover.

## Resultado esperado

- Card "Contratos" do William: 2 → **3**
- Card "Contratos" do Julio: inalterado (continua 0 hoje, sem R1 contabilizado)
- Card "No-Show" do Julio: **inalterado** (não vai aparecer no-show fantasma)
- Total Contratos da equipe: 2 → **3** (David + Raul + Josias do William; Marcão da Thayná aparece como o 4º total se também estiver no escopo, mas você reportou 3 vendas)
- Hubla: continua com 1 transação linkada ao novo attendee (não duplica Outside)

## Detalhes técnicos

**Tabelas tocadas (apenas dados):**
- `meeting_slots`: 1 INSERT (slot William) + 1 DELETE (slot Julio `c8e3f9f6-...`)
- `meeting_slot_attendees`: 1 INSERT (William) + 1 DELETE (Julio `4c77deba-...`)
- `hubla_transactions`: 1 UPDATE em `e54c677c-...` (`linked_attendee_id`, `linked_method='manual'`, `linked_at=now()`)

**Ordem de execução** (em bloco DO $$ atômico):
1. INSERT slot William → captura `v_new_slot_id`
2. INSERT attendee William → captura `v_new_att_id`
3. UPDATE hubla_transactions apontando para `v_new_att_id` (libera FK do attendee Julio)
4. DELETE attendee Julio
5. DELETE slot Julio

**Validação pós-execução:** rodar SELECT para confirmar que (a) novo slot/attendee existem, (b) slot/attendee do Julio sumiram, (c) hubla aponta para o novo, (d) `useR1CloserMetrics` retorna William=3.

## Risco

Baixo. Operação atômica. Slot do Julio é manual e não tem outros attendees nem integrações externas (Calendly/Google) — remoção limpa.

## Fora do escopo

- Não altero a regra geral de Outside (`paid < scheduled`).
- Não crio mapeamento automático de iniciais WF→William (você pediu pontual).
- Não mexo no auto-linker Hubla.