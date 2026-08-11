# Backfill de reembolsos (caução A000) — Grupo A aplicado, Grupo B pendente

Data: 2026-08-11

## Contexto
`meeting_slot_attendees.refunded_at` passou a ser a marca oficial de reembolso.
Semântica em produção:
- `caucoes_efetivas()` retorna **bruto** (todas as linhas com `contract_paid_at IS NOT NULL`) + coluna `refunded_at`.
- Ranking Closer da TV: **bruto** (não filtra `refunded_at`).
- Painel Comercial (`/crm/reunioes-equipe`): **líquido** (`refunded_at IS NULL`) + métrica própria de reembolso por closer.

Universo com fonte confiável (`deal_activities.activity_type IN ('refund_mcf_pay','refund_hubla')` com deal vinculado): **95 deals**
- Grupo A: 31 deals com todos os attendees zerados (`contract_paid_at IS NULL`).
- Grupo B: 64 deals com ao menos 1 attendee ainda contando como venda.
- Overlap A∩B = 0. Nenhum registro fora da janela de 60 dias (reembolso mais antigo do B: 14/07/2026).

## Grupo A — APLICADO (11/08/2026)
Regra do backfill (um attendee por deal: R1 não cancelada mais recente; fallback attendee mais recente):
1. `contract_paid_at` = `custom_fields->>'mcf_pay_paid_at'` → `hubla_transactions.sale_date` (A000, source mcfpay/hubla/kiwify) → Kiwify 10/07 (só Vitor Melo).
2. `refunded_at` = `custom_fields->>'mcf_pay_refunded_at'` → `created_at` do `deal_activities` de reembolso.
3. Ambos gravados no mesmo UPDATE (nunca conta como venda ativa em estado intermediário).

Resultado: **27 attendees / 27 deals** corrigidos.
Não aplicáveis: **4 deals sem nenhum attendee** (nada a atualizar):
- `dfb3f79c` Werley Monteiro da Silva
- `00c7e501` André Luiz Buthevitz
- `6161e950` JESSICA TESTE (registro de teste)
- `8d985821` Tarcísio Fernandes (deal duplicado; o A000 dele aponta pra este deal sem attendee)

### Validação antes/depois
| métrica | antes | depois |
|---|---|---|
| Agosto bruto | 75 | 77 |
| Agosto líquido | 75 | 75 |
| Agosto reembolsados | 0 | 2 |
| Hoje (11/08) bruto | 5 | 5 |
| Julho bruto | 237 | 258 |
| Julho líquido | — | 237 |
| TV ranking Julio (mês) | 31 | 33 |

Líquido preservado em todos os períodos; o bruto subiu exatamente o volume restaurado.
A TV lê `tv_public_snapshots` (cache), então o número novo aparece no próximo ciclo de snapshot.

## Grupo B — PENDENTE (não aplicar sem decisão)
64 deals, 66 attendees, R$ 70.820 em `metadata->>'amount'`, 5 closers
(Julio 29, William Ferreira 20, Leticia Faustino 14, Jessica Martins 2, Jessica Bellini 1).
- 58 deals com A000 vinculado; 6 sem vínculo A000 em `hubla_transactions` — mas **todos** têm A000 real de R$497 no MCF Pay (`mcf_pay_transaction_id` + `amount 497 / payment.refunded`). Causa: 4 transações MCF Pay nunca espelhadas em `hubla_transactions`, 1 sem `linked_deal_id` (Kelwim Correa) e 1 vinculada a deal duplicado (Tarcísio Fernandes).
- **Ressalva Claudio Diniz** (`7c2c20ee`): 2 attendees pagos, mas apenas **1** reembolso real (`pay_zedlpw4q6m1etvge`, R$12.000, A001 - Incorporador Completo, 30/07 17:27). O A000 de R$497 (15/07, closer William) **não foi reembolsado**. Aplicar `refunded_at` somente no attendee da R2 (`117350b7`, closer Jessica Martins). O "duplo lançamento de R$12.000" era artefato de agregação, não duplicidade no banco.
