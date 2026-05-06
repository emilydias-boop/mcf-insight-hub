## Marcar Ricardo Gomes Vendeth como Contrato Pago Outside

### Contexto
- **Lead**: Ricardo Gomes Vendeth (telefone +5562998860906)
- **Deal**: `724d9aae-975e-4de0-8289-ef6cb35879ef` (origin Inside Sales `e3c04f21...`)
- **Attendee R1**: `ebc92763-908e-44c6-b590-73284be3d11b` — R1 Realizada em 28/04/2026, status `completed`, sem `contract_paid_at`
- **Hubla**: nenhuma transação encontrada para esse lead
- **Stage atual**: "Reunião 01 Realizada"

### Ação (via insert/update no banco — sem mexer em código)

1. **Atualizar attendee** `ebc92763-908e-44c6-b590-73284be3d11b`:
   - `status = 'contract_paid'`
   - `contract_paid_at = '2026-04-28T18:30:00+00:00'` (data/hora da R1)

2. **Mover deal** `724d9aae-975e-4de0-8289-ef6cb35879ef` para o stage "Contrato Pago" do mesmo `origin_id` (busca dinâmica via `crm_stages` com `ilike '%contrato%pago%'`).

3. **Não criar transação Hubla sintética** — conforme sua escolha, marcação direta no attendee. Como não há `linked_attendee_id` em `hubla_transactions`, ele não aparecerá nos relatórios que dependem da Hubla (faturamento/billing). Ele aparecerá:
   - ✅ Como Contrato Pago no funil/agenda do Closer
   - ✅ Nas métricas de Closer baseadas em `contract_paid_at IS NOT NULL`
   - ⚠️ NÃO entrará no Outside detection padrão (`useSdrOutsideMetrics`/`useOutsideDetectionBatch`), pois ambos exigem uma `hubla_transactions` com `offer_name` Outside válido.

### ⚠️ Importante sobre "Outside"
A lógica de Outside hoje **depende de uma transação Hubla** com offer_name em `OUTSIDE_OFFER_NAMES` ('Contrato - Curso R$ 97,00' ou 'Contrato Perfil A - Vitrine A010'). Marcar só o attendee como `contract_paid` faz ele contar como **Contrato Pago normal**, não como **Outside**.

Se você quer que ele apareça também nas métricas de **Outside do SDR**, eu preciso criar uma `hubla_transactions` sintética (opção 3 da pergunta original). Posso fazer isso adicionalmente — me avise no chat antes de eu rodar.

### Execução
Migration de UPDATE em duas tabelas (`meeting_slot_attendees` + `crm_deals`). Sem alterações de código, sem alterações de schema.
