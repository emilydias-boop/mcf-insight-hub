# Investigação: filtro de Closer no Kanban de Negócios retorna 0 para Leticia Faustino C

## Onde fica o filtro

Não existe um filtro de "closer" no Kanban. O dropdown usado é o filtro de **Responsável (owner)**:

- UI: `src/components/crm/DealFilters.tsx` (campo `filters.owner` em `DealFiltersState`).
- Opções: `src/hooks/useDealOwnerOptions.ts` — monta a lista a partir de `profiles` + `user_roles`; o sufixo `(CLOSER)` vem de `roleLabel = role.toUpperCase()`, ou seja é só o rótulo da role do **profile**, não um vínculo com a tabela `closers`.
- Aplicação: `src/pages/crm/Negocios.tsx:470-480` — comparação direta `deal.owner_profile_id !== filters.owner` (ou `deal.owner_id` para opções legadas `email:...`).

Ou seja, o filtro é por **propriedade do negócio** (`crm_deals.owner_profile_id`) e **nunca** por `r1_closer_email` / `r2_closer_email`. A atividade de closer (R1/R2 realizadas, contrato pago) vive nesses campos de e-mail e em `meeting_slots`, que esse filtro ignora.

## Por que a Leticia dá zero

Existem **dois profiles duplicados** com o mesmo e-mail `leticia.faustino@minhacasafinanciada.com`:

| profile_id | full_name | access_status | roles | deals com owner_profile_id |
|---|---|---|---|---|
| `9529ecc8-af6f-44a2-9f3a-7b375612befb` | Leticia Faustino | desativado | (nenhuma) | 78 |
| `e89664d6-33ec-4a5b-bbf5-217a88dd3b18` | Leticia Faustino C | ativo | closer | 1 |

- A opção "Leticia Faustino C (CLOSER)" é o profile ativo `e89664d6...`, dono de apenas **1** negócio (em "Reunião 02 Realizada"). Nos outros estágios o resultado é 0 — exatamente o sintoma.
- Os 78 negócios em que ela é dona estão no profile antigo `9529ecc8...` (`desativado`, sem roles), que não é a opção rotulada como CLOSER.
- A atividade real de closer são **552 negócios com `r1_closer_email = leticia.faustino@...`**: 381 em "Reunião 01 Realizada", 60 em "Venda realizada", 50 em "Reunião 02 Realizada", 19 em "Contrato Pago", 10 "No-Show R2" etc. Nenhum é capturado pelo filtro de owner.
- Complemento: o registro em `closers` (`73bf8108-...`, BU incorporador, ativo) aponta para `employees.id = 8f3506fc-...` cujo `user_id` é **NULL** — não há vínculo `closers → employee → profile`.

## Causa raiz (duas camadas)

1. **Semântica**: o dropdown filtra dono do negócio, não closer da reunião. Para uma closer que atende leads pertencentes aos SDRs, o resultado tende naturalmente a zero.
2. **Dados**: profile duplicado — o histórico de propriedade (78 deals) ficou no profile desativado, enquanto a opção visível é o profile novo (1 deal); e `employees.user_id` da closer está nulo.

## Nada foi alterado

Este é apenas o mapeamento técnico pedido. Caminhos possíveis, se quiser seguir depois: (a) adicionar um filtro explícito "Closer (R1/R2)" casando `r1_closer_email`/`r2_closer_email`; (b) consolidar os profiles duplicados e preencher `employees.user_id`; (c) fazer o filtro de owner casar por e-mail, unificando duplicados.