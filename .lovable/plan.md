

## Diagnóstico: Pendentes pegando deal_id da pipeline errada

### Causa raiz confirmada

Os 2 casos do print mostram o mesmo padrão:
- **Eduardo da Silva Queiroz**: tem deal correto na `PIPELINE INSIDE SALES` (com R2 Jessica Martins 10/02 às 11:00 = Realizada), mas o relatório está pegando o deal da `PIPELINE - INSIDE SALES - VIVER DE ALUGUEL` (que só tem um R2 refunded de 13/04).
- **Jackson Willians Mariano**: tem R2 realizada com Jessica Martins 10/04 às 10:00 na `PIPELINE INSIDE SALES` (R1 Cristiane Gomes 08/04, contract_paid), mas o relatório está pegando outro deal de outra BU.

A regra de negócio (memória `lead-segregation-by-product-v2` e `hubla-routing-collision-logic-v5`): **qualquer lead com compra A010 deve ser tratado como Inside Sales, independente de outros produtos**.

### Por que está falhando hoje

No `useContractLifecycleReport.ts`, o merge entre contrato Hubla e R2 da RPC é feito por telefone (9 dígitos) ou email. Mas a RPC `get_carrinho_r2_attendees` retorna **um R2 por telefone deduplicado** — escolhendo qualquer R2 da semana. Quando o lead tem múltiplos deals em pipelines diferentes (uma da BU correta com R2 realizada, outra de BU errada com R2 refunded), a RPC pode estar retornando o R2 errado, ou o telefone do contrato Hubla está casando com o lead errado.

Além disso, esses contratos A010+A000 estão entrando no relatório como órfãos porque:
1. O contrato Hubla tem email/telefone do lead
2. A RPC traz o R2 da semana, mas se o R2 correto está na pipeline correta E a deduplicação por telefone na RPC priorizou o R2 errado, a linha primária aponta para o deal errado
3. Resultado: aparece como "pendente sem R2" mesmo tendo R2 realizada

### Solução proposta

Mudar a lógica de matching para priorizar **deals da BU correta para A010**:

1. **Na RPC `get_carrinho_r2_attendees`**: Quando há múltiplos R2 para o mesmo telefone na semana, priorizar:
   - R2 com `attendee_status` = `contract_paid`/`presente`/`completed` sobre `refunded`/`cancelled`
   - R2 cujo `deal.origin_id` aponta para uma origem da BU Inside Sales (se o lead tem compra A010)
   - Mais recente como tiebreaker

2. **No `useContractLifecycleReport.ts`**: Após o merge inicial, para órfãos com email/telefone:
   - Buscar **todos** os R2 do telefone na semana (não só o deduplicado)
   - Se houver R2 válido (não refunded/cancelled) em **qualquer** deal do mesmo telefone, usar esse R2
   - Isso resolve os casos onde o lead tem deal duplicado entre BUs

### Plano de implementação

**Etapa 1 — Investigar via SQL** (sem alterar código):
- Confirmar para Eduardo (`+5522981379394`) e Jackson (`11972143532`) quais R2s existem na semana, em quais deals/origens, e qual a RPC está retornando.
- Validar a hipótese antes de mexer em RPC ou hook.

**Etapa 2 — Atualizar a RPC `get_carrinho_r2_attendees`** (migração SQL):
- Adicionar critério de priorização na deduplicação por telefone:
  - 1º: `attendee_status` válido (`contract_paid` > `presente` > `completed` > `invited` > `scheduled` > `refunded` > `cancelled`)
  - 2º: deal com `origin_id` em Inside Sales se o lead tem A010
  - 3º: `scheduled_at` mais recente

**Etapa 3 — Adicionar coluna "Motivo" no Pendentes**:
- Após corrigir a RPC, classificar cada órfão restante com motivo claro:
  - `outside_legitimo` (compra direta sem R2)
  - `recompra_outra_semana` (R2 em outra safra)
  - `bu_errada` (R2 existe mas em pipeline incorreta — para os que ainda escaparem)
  - `sem_r2` (genuinamente sem R2)
- Exibir como badge na coluna nova em `R2ContractLifecyclePanel.tsx`.

### Arquivos alterados

- `supabase/migrations/<nova>.sql` — atualizar RPC `get_carrinho_r2_attendees` com priorização
- `src/hooks/useContractLifecycleReport.ts` — adicionar enriquecimento de motivo nos órfãos
- `src/components/crm/R2ContractLifecyclePanel.tsx` — coluna "Motivo" + badges

### Próximo passo

Preciso rodar SQL exploratório nos 22 nomes Pendentes para validar a hipótese caso a caso antes de tocar na RPC. Após sua aprovação, executo a investigação completa e ajusto a RPC com os critérios de priorização certos.

