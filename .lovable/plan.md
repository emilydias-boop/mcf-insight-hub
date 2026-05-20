## Entendimento

Você quer **manter as marcações já aplicadas** (reuniões passadas da Leticia Faustino com ANAMNESE + Contrato Pago continuam destacadas no histórico) e apenas **parar de aplicar a regra daqui pra frente**.

## Como funciona hoje

A regra `Anamnese - Leticia Faustino` na tabela `r2_special_markings` tem campos `valid_from` (atual: `2026-05-12`) e `valid_until` (atual: `NULL` = vigente). O matcher (`matchR2SpecialMarking`) usa a **data da reunião** (`scheduled_at`) como referência:

```ts
if (rule.valid_until && refYmd > rule.valid_until) continue;
```

Ou seja, basta fechar a janela: reuniões com `scheduled_at <= hoje` continuam casando, reuniões futuras não.

## Mudança

**1 única ação — UPDATE na regra existente:**

```sql
UPDATE public.r2_special_markings
SET valid_until = CURRENT_DATE,
    active = true   -- mantém ativa para o histórico ainda renderizar
WHERE id = '59de7395-7bf3-4fc3-9006-ff6b1bedc28e';
```

## O que NÃO muda

- Tabela `r2_special_markings` permanece (já foi recriada na migration anterior, vou desfazer aquele DROP recriando-a com o registro original — ver detalhes técnicos).
- Hooks, types, modal de config e badges no AgendaCalendar / R2CloserColumnCalendar / R2LeadBadges / R2MeetingDetailDrawer / AgendaR2 — tudo permanece como estava antes.
- Histórico visual da Leticia Faustino: preservado.

## Detalhes técnicos importantes

Na rodada anterior eu já executei `DROP TABLE r2_special_markings CASCADE` e deletei 3 arquivos frontend (`useR2SpecialMarkings.ts`, `R2SpecialMarkingsConfigModal.tsx`, `r2SpecialMarking.ts`). Para atender ao novo pedido preciso reverter isso:

1. **Migration de recriação**: recriar `public.r2_special_markings` com mesma estrutura (colunas, RLS, trigger de updated_at) e **reinserir** o único registro original (`id 59de7395-…`, closer `3f298f4e-ab18-4c37-ad01-e90d98cf6189`, name "Anamnese - Leticia Faustino", required_channel ANAMNESE, require_contract_paid true, badge_label "Anamnese Leticia", bg #7c3aed, text #ffffff, icon 📋, valid_from 2026-05-12) já com **`valid_until = CURRENT_DATE`**.
2. **Restaurar 3 arquivos** frontend deletados (vou recriar com o conteúdo original).
3. Imports/uso em `AgendaCalendar.tsx`, `R2CloserColumnCalendar.tsx`, `R2LeadBadges.tsx`, `R2MeetingDetailDrawer.tsx`, `AgendaR2.tsx` — **não preciso alterar**, eles já estavam apontando pros arquivos que vou recriar.

## Resultado final

- Histórico (R2 da Leticia até hoje) continua com o badge roxo "Anamnese Leticia".
- Qualquer reunião agendada/realizada **a partir de amanhã** não recebe mais a marcação.
- Configuração permanece editável no modal (caso queiram ajustar a data ou desativar de vez no futuro).

**Confirma esse plano?** Se preferir uma data de corte diferente de "hoje" (ex.: a data em que decidiram parar a captação paga), me diga.
