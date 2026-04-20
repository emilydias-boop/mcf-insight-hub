

## Mapeamento completo (auditoria do que está conectado e onde diverge)

### Camada 1 — RPC `get_carrinho_r2_attendees` (única fonte de verdade)

Fonte: SQL na função STABLE no banco. Recebe:
- `p_week_start` (Quinta da safra)
- `p_window_start` / `p_window_end` (janela de scheduled_at do R2)
- `p_apply_contract_cutoff` (true sempre que a tela quer "dentro do corte")
- `p_previous_cutoff` (Sex 12:00 da PRÓPRIA safra — é o cutoff de fechamento)

Lógica chave:
1. **Inclusão de attendee**: R2 dentro de `[p_window_start, p_window_end)` E sem `carrinho_week_start`, OU `carrinho_week_start = p_week_start` (encaixados).
2. **Deduplicação**: por sufixo de 9 dígitos do telefone, score por status.
3. **`dentro_corte`**: TRUE se contrato (r1 → r2 → hubla A000) caiu em `[previousCutoff, windowEnd)` OU se contrato é anterior mas R2 caiu após `previousCutoff` E não há parceria comprada antes do `previousCutoff`.

### Camada 2 — `getCarrinhoMetricBoundaries` (define a janela)

Para safra Qui 09/04 → Qua 15/04:
- `r2Meetings.start` = Qui 09/04 00:00
- `r2Meetings.end` = Sex 17/04 12:00 (próxima sexta no corte)
- `previousCutoff` = Sex 10/04 12:00 (sexta DA safra) ← este é o problema central

Ou seja, o `previousCutoff` está usando a sexta DENTRO da safra, não a sexta ANTERIOR à safra. O nome do parâmetro engana.

### Camada 3 — Hooks (todos consomem a RPC, mas com filtros diferentes)

| Hook | Fonte | Filtro extra |
|---|---|---|
| `useCarrinhoUnifiedData` | RPC | nenhum (raw) |
| `useR2CarrinhoKPIs` | unified | classifica por status name + `dentro_corte` |
| `useR2CarrinhoData('aprovados')` | unified | `isAprovado && dentro_corte` |
| `useR2CarrinhoData('aprovados_proxima_safra')` | unified | `isAprovado && !dentro_corte` |
| `useR2CarrinhoData('agendadas')` | unified | meeting_status ≠ cancelled/rescheduled |
| `useR2ForaDoCarrinhoData` | unified | `isForaDoCarrinho` (reembolso/desistente/reprovado/próxima semana/cancelado) |
| `useContractLifecycleReport` (Relatório) | RPC + Hubla órfãos | classifica por `attendee_status` (situação) + `dentroCorte` + Hubla orphan A000 |
| `useR2CarrinhoVendas` | NÃO usa RPC; query própria em `meeting_slot_attendees` | janela `aprovadosWindow` (Qui→próxSex 12:00), filtra por `r2_status_id` HARDCODED `24d9a326...` |

### Os 4 conflitos REAIS detectados

1. **`previousCutoff` mal nomeado e mal calculado**  
   Hoje é a sexta DENTRO da safra (Qui+1). Não existe lookup do `horario_corte` da config da semana ANTERIOR. Resultado: contratos pagos ANTES de Sex 10/04 12:00 (mas dentro da janela `r2Meetings`) ficam com `dentro_corte = false` mesmo pertencendo legitimamente à safra atual. Por isso o "Aprovado dentro do corte" caiu de 46 → 36.

2. **Vendas usa hook próprio com closer/r2_status_id hardcoded**  
   `useR2CarrinhoVendas` ignora a RPC e busca attendees direto, com `r2_status_id = '24d9a326...'`. Se o ID do status "Aprovado" mudar, a aba Vendas quebra silenciosamente. Também não respeita encaixados nem `dentro_corte`.

3. **Relatório classifica por `attendee_status`, Carrinho R2 classifica por `r2_status_name`**  
   O mesmo lead pode ser:
   - "Realizada" no Relatório (porque attendee_status = `completed`) E
   - "Aprovado" no Carrinho R2 (porque r2_status_name = "Aprovado")
   
   São dimensões DIFERENTES. Um lead "Aprovado" mas com attendee_status = `invited` aparece no Carrinho R2 como Aprovado mas SUMIU do Relatório (não está em "Realizadas"). Por isso o "Aprovado" do Relatório (36) é menor que o do Carrinho (38) — os 2 leads de diferença são aprovados que não tiveram attendee_status ainda marcado como completed/contract_paid.

4. **Hubla órfãos só existem no Relatório**  
   `useContractLifecycleReport` adiciona contratos pagos do Hubla que não têm R2 nesta semana. O Carrinho R2 não tem essa noção (só conta o que tem R2 marcado). Por isso "Total Pagos" (65) > soma das categorias do Carrinho R2.

### Por que a lista oficial dá 44 e nenhuma tela bate

Sua lista de 44 é a soma operacional de "leads aprovados que VÃO pro carrinho de Sex 17/04". Esse universo inclui:
- Aprovados com R2 desta semana E contrato pago dentro da janela operacional
- Aprovados sem attendee_status = completed (ainda) mas com R2 e contrato pagos
- Aprovados encaixados manualmente

Hoje as duas telas fragmentam isso por filtros incompatíveis (corte mal calculado + dimensões de classificação diferentes).

## Plano de correção (em fases)

### Fase 1 — Corrigir o `previousCutoff` (a raiz do problema)

`src/lib/carrinhoWeekBoundaries.ts`:
- Renomear `previousFriday` para `safraOpeningCutoff`
- Calcular como **sexta-feira IMEDIATAMENTE ANTERIOR à `weekStart` (Quinta)** no horário de corte (não a sexta da própria safra). Isso é a sexta de fechamento da safra anterior = abertura da safra atual.
- Buscar `horario_corte` do `previousConfig` (já passado nos hooks).
- Para safra Qui 09/04: `safraOpeningCutoff = Sex 03/04 12:00` (sexta da semana ANTERIOR), e `vendasParceria.end / r2Meetings.end = Sex 10/04 12:00` (sexta DA safra).

⚠️ Importante: hoje `r2Meetings.end` está como `nextFridayCutoff = Sex 17/04 12:00` (próxima sexta após a safra). Isso está errado — está alongando a janela em uma semana inteira. O correto é `Sex 10/04 12:00` (sexta DA safra).

Resultado esperado: Aprovados dentro do corte sobe para refletir a janela real Sex anterior → Sex da safra.

### Fase 2 — Unificar a definição de "Aprovado para o Carrinho"

Criar função única `isCarrinhoEligible(row)` em `useCarrinhoUnifiedData.ts` que retorna true quando:
- `r2_status_name` contém "aprovado" E
- `dentro_corte = true` E
- attendee_status NÃO é cancelled/no_show/refunded

Aplicar essa função em:
- `useR2CarrinhoKPIs.aprovados` (substitui o filtro atual)
- `useR2CarrinhoData('aprovados')` (substitui)
- `useContractLifecycleReport` cria nova bucket "Aprovado Carrinho" com a mesma regra (não depende mais de `situacao=='realizada'`)

Mantém "Próxima Safra" como `isAprovado && !dentro_corte`.

### Fase 3 — Fazer Vendas usar a RPC

Reescrever `useR2CarrinhoVendas` para:
- Receber `unifiedData` como input (lista de aprovados elegíveis)
- Buscar transações `parceria` da janela `vendasParceria`
- Match contra a lista vinda da RPC (já deduplicada)
- Eliminar o `r2_status_id` hardcoded e a query duplicada de attendees

### Fase 4 — Alinhar rótulos do Relatório

Renomear no Relatório o subcard "Aprovado" para "Aprovado (R2 Carrinho)" e usar a regra unificada da Fase 2. O número será idêntico ao "Aprovados" do Carrinho R2.

### Fase 5 — Checklist de validação

| Métrica | Carrinho R2 | Relatório | Esperado |
|---|---|---|---|
| Aprovados (corte atual) | KPI "Aprovados" | Card "Aprovado (R2 Carrinho)" | mesmo número |
| Próxima Safra | KPI "Próxima Safra" + aba | Card "Aprovado — Próxima Safra" | mesmo número |
| Total contratos pagos | KPI "Contratos (R1)" | KPI "Total Pagos" | divergem por design (Total Pagos inclui órfãos sem R2) |
| Vendas parceria | Aba Vendas | (não existe no Relatório) | usa lista unificada de aprovados |

### Escopo

- 1 arquivo de boundaries (Fase 1)
- 1 hook unified + helper (Fase 2)
- 1 hook de vendas reescrito (Fase 3)
- 1 ajuste de rótulo no Relatório (Fase 4)
- Zero migration de banco (a RPC já aceita os parâmetros corretos)

### Risco

A Fase 1 muda o cálculo do corte para TODAS as semanas históricas. Recomendo:
1. Implementar Fases 1+2 e validar primeiro contra a lista oficial de 44.
2. Só depois fazer Fases 3 e 4.

Confirme a abordagem ou diga se quer começar por uma fase específica.

