## Objetivo

Aproveitar leads "queimados" da BU Incorporador MCF criando cards espelho na BU Consórcio em **Novo Lead (Form)**, com tag identificando o canal de origem (R1 Realizada / R2 Realizada / Sem interesse).

## Regras

| # | Fonte (Incorporador MCF) | Filtro de exclusão | Destino | Tag |
|---|---|---|---|---|
| 1 | Deal entra em **R1 Realizada** | Não pode ter `contract_paid_at` preenchido (não comprou A000 - Contrato) | Consórcio → Novo Lead (Form) | `R1 Realizada` |
| 2 | Deal entra em **R2 Realizada** | Não pode ter compra dos produtos A001 / A009 (Parceria MCF) em `hubla_transactions` | Consórcio → Novo Lead (Form) | `R2 Realizada` |
| 3 | Deal entra em uma stage de **Sem Interesse** do Incorporador (a confirmar qual stage exatamente) | — | Consórcio → Novo Lead (Form) | `Sem interesse` |

Todas as regras aplicam:
- **Dedup**: se já existe deal na origem Consórcio para o mesmo contato (match por email lower + últimos 9 dígitos do telefone), **não cria novo** — apenas adiciona a tag ao deal existente.
- **Owner**: round-robin entre SDRs ativos da BU Consórcio (usa a lógica atual de `get_next_lead_owner` / distribuição unificada).
- **Vigência**: só para movimentações **daqui pra frente** (sem backfill).

## Como usar a infraestrutura existente

O projeto já tem `deal_replication_rules` + edge function `process-deal-replication`, então não precisa de tabela nova. Ajustes necessários:

1. **`match_condition`**: hoje o schema suporta `contains/equals/includes_any/includes_all` sobre `product_name` / `tags` / `custom_field`. Vou adicionar suporte a duas novas verificações negativas no processador:
   - `not_contract_paid` — bloqueia replicação se `crm_deals.contract_paid_at IS NOT NULL`.
   - `not_purchased_products` — bloqueia se existir transação `completed` em `hubla_transactions` com `product_code` na lista (ex.: `A001`, `A009`) para o mesmo email/phone9.
2. **Dedup**: alterar o `process-deal-replication` para, antes de inserir, procurar deal existente na `target_origin_id` com match por email lower + phone9. Se achar, faz `UPDATE` acrescentando a tag e pula insert.
3. **Reversão do R1/R2 tardio**: se o deal fonte depois avançar para Contrato Pago / comprar parceria, disparo um "cancel replica" que remove a tag e move o mirror para uma stage de descarte (a definir — sugiro `Descartado`/`Perdido` no Consórcio, ou simplesmente arquivar). *Confirmar com você antes de implementar essa parte 2.*
4. **UI**: criar as 3 regras via `ReplicationRulesEditor` (Administração → Automações → Cross-Pipeline) — não precisa mexer na UI, só na engine.

## Perguntas em aberto para eu resolver antes de codar

1. **Qual é o nome exato da stage "Sem Interesse" no pipeline Incorporador MCF?** Vou listar os stages do Inside Sales pra você escolher — pode ser algo como `Sem Interesse`, `Perdido`, `Descarte`, etc.
2. **Reversão tardia**: quando um deal cai em R1 Realizada e depois vira Contrato Pago (comprou), você quer que o card espelho no Consórcio seja **removido/arquivado automaticamente** ou **deixa como está** (afinal, o SDR do Consórcio pode ter avançado o card)?

## Entregas técnicas

1. Migração:
   - Adicionar tipos `not_contract_paid` e `not_purchased_products` no `match_condition` (só schema TS, é jsonb).
2. Edge function `process-deal-replication`:
   - Avaliar os dois filtros negativos.
   - Implementar dedup por email + phone9 na origem alvo.
   - Aplicar tag e disparar round-robin de owner via `get_next_lead_owner`.
3. Inserir as 3 regras via `supabase--insert` apontando para os IDs corretos de origem/stage (após você responder a pergunta 1).
4. QA: validar com Playwright que ao mover um deal manualmente para R1 Realizada sem contract_paid, o card aparece em Consórcio → Novo Lead (Form) com tag correta e distribuído a um SDR.
