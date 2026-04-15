

## Diagnóstico

O `contract_paid_at` está gravado no **attendee R1**, não no R2. A query atual:

1. Busca attendees R2 com `contract_paid_at` → encontra **0** (nenhum R2 tem esse campo preenchido)
2. Depois busca attendees R1 com `contract_paid_at` → encontra **88**, mas marca todos como "Aguardando R2" sem cruzar com a tabela R2 via `deal_id`

Confirmação do banco: dos 88 contratos pagos em abril, **74 já têm R2 agendada** via `deal_id`. Vários já têm `r2_status_id`, closer R2, e datas — mas nada disso aparece na tela.

## Correção

Reescrever `useContractLifecycleReport.ts` com a lógica invertida:

1. **Ponto de partida**: attendees R1 com `contract_paid_at` no período (é onde o dado mora)
2. **Cruzamento R2**: para cada `deal_id`, buscar o attendee R2 correspondente (join com `meeting_slots.meeting_type = 'r2'`, excluindo cancelled/pre_scheduled)
3. **Enriquecimento**: puxar `r2_status_options` (nome/cor), closer R2, `carrinho_status`, `carrinho_week_start`, `scheduled_at` do R2
4. **Situação derivada**: calcular com base no R2 encontrado (ou não)

### Arquivos alterados

**`src/hooks/useContractLifecycleReport.ts`** — reescrever a queryFn:
- Query principal: `meeting_slot_attendees` com `meeting_type = 'r1'` e `contract_paid_at` no range
- Query secundária: para os `deal_ids` coletados, buscar attendees R2 com joins de status/closer
- Montar mapa `deal_id → R2 info` e enriquecer cada row
- Situação: `hasR2` agora baseado no cruzamento real

**`src/components/crm/R2ContractLifecyclePanel.tsx`** — sem mudanças necessárias (a interface `ContractLifecycleRow` já tem os campos certos, só precisa receber dados corretos)

