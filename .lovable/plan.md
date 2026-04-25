# Corrigir Funil por Canal — "uma fotografia por coluna, dentro da janela"

## Princípio acordado
> Cada coluna é uma fotografia independente do que aconteceu **no intervalo selecionado**. Um lead conta no máximo uma vez por coluna. Não importa se ele apareceu antes ou comprou depois — só importa se o evento daquela coluna caiu dentro da janela.

## Diagnóstico (caso 02/04 a 10/04, BU Incorporador)

Comparação entre auditoria direta no banco vs. o que a UI exibe hoje:

| Coluna | Esperado (auditoria) | UI mostra | Problema |
|---|---|---|---|
| R1 Agendada | 219 | 291 | UI **infla** (~33% a mais) — conta cada attendee/reagendamento |
| R1 Realizada | 193 | 177 | UI **subtrai** (~8% a menos) — possíveis exclusões na RPC |
| No-Show | 74 | 93 | UI **infla** — no-shows duplicados por reagendamento |
| Contrato Pago | 55 | 55 | ✅ OK |
| R2 Agendada | 46 | 47 | OK (diferença de 1) |
| R2 Realizada | 38 | 39 | OK |
| Aprovados | 29 | 30 | OK |
| Reprovados | — | 7 | OK |
| Próx. Semana | — | 2 | OK |
| Venda Final | 84 (emails únicos no período) | 11 | UI **filtra** vendas de recompradores e exige "primeira-compra-da-vida" — você quer **vendas que aconteceram no período**, ponto |

**Causa raiz:**
1. A RPC `get_channel_funnel_metrics` (R1/Entradas/Contrato) conta attendees, não deals únicos. Reagendamento vira contagem dupla/tripla.
2. A whitelist de "Venda Final" exige que o cliente **nunca tenha comprado parceria nos últimos 12 meses** (excluindo upsells/recompras como se fossem "não-vendas"). Isso esconde 73 vendas reais.
3. R1 e R2 usam classificadores de canal diferentes (RPC vs. front), então um mesmo deal pode parecer "ANAMNESE" em R1 e "OUTROS" em R2 — a soma das linhas não fecha como o usuário espera.

---

## Plano de correção

### Mudança 1 — Reescrever o cálculo de R1/Entradas/Contrato no front
**Arquivo:** `src/hooks/useChannelFunnelReport.ts`

Substituir a chamada `get_channel_funnel_metrics` por queries diretas do front (mesmo padrão que já fazemos para R2/Carrinho), garantindo:
- **Dedupe por `deal_id`** em todas as métricas R1.
- R1 Agendada = `COUNT(DISTINCT deal_id)` de attendees R1 com `scheduled_at` na janela, BU = incorporador, status NÃO em `cancelled/rescheduled`.
- R1 Realizada = mesma base, status `completed`.
- No-Show = mesma base, status `no_show`.
- Contrato Pago = `COUNT(DISTINCT deal_id)` com `contract_paid_at` na janela.
- Entradas = `COUNT(DISTINCT id)` de `crm_deals` com `created_at` na janela e origem da BU (sem dedupe — entrada é evento de criação do deal).

Isso elimina os 33% de inflação de R1 Agendada e os no-shows duplicados.

### Mudança 2 — Remover o filtro "12 meses de recompradores" de Venda Final
**Arquivo:** `src/hooks/useChannelFunnelReport.ts`, query `funnel-parceria-conversions-v3`

- **Remover** a query `priorBuyers` (lookback 12 meses) e o filtro `priorEmails.has(email)`.
- **Manter** apenas: dedupe por email **dentro do período**, whitelist de produtos válidos, status `completed`, sources legítimas.
- Resultado esperado para o caso: Venda Final salta de 11 → ~80 (alinhado às 84 transações únicas detectadas).

Isso devolve à coluna o significado intuitivo: **vendas únicas que entraram no período**.

### Mudança 3 — Unificar classificador de canal entre R1 e R2
**Arquivo:** `src/hooks/useChannelFunnelReport.ts`

Hoje:
- R1 → classificado dentro da RPC `get_channel_funnel_metrics` (lógica server-side).
- R2 → classificado no front via `classifyChannelWith30dRule` + tags do deal.
- Venda Final → classificado no front via `classifyChannelWith30dRule` + R1 attendees.

Após a Mudança 1, **tudo passa a ser classificado no front**, com a mesma função `classifyChannelWith30dRule(tags, originName, firstA010Purchase, referenceDate)` aplicada a `crm_deals`. Resultado: a soma das linhas A010+ANAMNESE+OUTROS bate em todas as colunas porque o mesmo deal recebe sempre o mesmo canal.

### Mudança 4 — Atualizar tooltips
**Arquivo:** `src/components/relatorios/ChannelFunnelTable.tsx`

Reescrever os tooltips refletindo as novas regras:
- R1 Agendada: "Deals únicos com R1 cujo `scheduled_at` cai na janela. Cada lead conta uma vez (sem inflar por reagendamento)."
- R1 Realizada: "Deals únicos cuja R1 ficou com status `completed` e `scheduled_at` na janela."
- No-Show: "Deals únicos cuja R1 ficou com status `no_show` e `scheduled_at` na janela."
- Contrato Pago: "Deals únicos cujo `contract_paid_at` cai na janela."
- R2 Agendada/Realizada/Aprovados/Reprovados/Próx. Semana: já estavam corretas.
- Venda Final: "Vendas únicas (por email) de produtos de parceria com `sale_date` na janela. **Inclui upsells e recompras** — é uma fotografia das vendas que entraram no período, não 'primeira compra da vida'."
- Fat. Bruto/Líquido: idem, inclui recompras.

---

## Verificação esperada após implementação (caso 02/04 a 10/04)

| Coluna | Antes | Depois (esperado) |
|---|---|---|
| R1 Agendada | 291 | ~219 |
| R1 Realizada | 177 | ~193 |
| No-Show | 93 | ~74 |
| Contrato Pago | 55 | 55 |
| R2 Agendada | 47 | ~47 |
| R2 Realizada | 39 | ~39 |
| Aprovados | 30 | ~30 |
| Venda Final | 11 | ~80 |
| Soma A010+ANAMNESE+OUTROS | desbalanceada | bate em toda coluna |

---

## Arquivos a modificar
1. `src/hooks/useChannelFunnelReport.ts` — reescrever queries R1/Entradas/Contrato + remover filtro de recompradores
2. `src/components/relatorios/ChannelFunnelTable.tsx` — atualizar tooltips

## Out of scope (posso fazer em outra rodada)
- Apagar a RPC `get_channel_funnel_metrics` no banco (ela continua viva sem uso)
- Ajustar a tabela secundária "Canal — Conversões" com a mesma lógica
- Adicionar exportação CSV reflectindo os novos números