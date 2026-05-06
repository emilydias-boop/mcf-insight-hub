## Mudança de regra do Carrinho R2

Hoje o ciclo da safra opera entre dois cortes (ex.: Sex 12:00 da semana anterior → Sex 12:00 da semana atual). A nova regra elimina o corte intra-dia: a safra passa a ser uma janela **fixa de 7 dias corridos**, alinhada com a janela de Contratos.

### Nova regra (alinhada com sua resposta)

- **Safra operacional do Carrinho** = `Quinta 00:00 → Quarta 23:59:59` (mesma janela já usada hoje para "Contratos Pagos").
- **Não existe mais** o "corte de sexta 12:00" para fechar/abrir safra. Quem paga A000 dentro da semana Qui→Qua é da safra atual, ponto.
- **Card "Semanas Anteriores ↩"** continua existindo, mas com critério diferente: agora marca leads com R2 marcada nesta semana cujo contrato A000 foi pago **antes da quinta 00:00** desta safra (ou seja, semanas calendário anteriores). Maria Isabel, Roberto Cezar, Baroli, Pri, Italo, etc. (todos pagos 30/04) deixam de ser ↩.
- **Janela de Vendas Parceria** (a regra própria da parceria que você mencionou): permanece como está hoje (Sex 00:00 → Seg 23:59 da semana seguinte). Não mexer.
- **Parceiros agora aparecem nos KPIs** com badge/flag visual "Parceria":
  - Removemos a exclusão global por `partnerEmailsSet` no loop de `useR2CarrinhoKPIs`.
  - Em vez de pular o lead, marcamos uma flag `isParceria` no row (lead também comprou A001-A009 / R001 / INCORPORADOR / Renovação / Parceria dentro da janela de parceria).
  - Cada card (R2 Agendadas, Realizadas, No-Show, Pendentes, Aprovados, Fora) ganha um sub-indicador `Parceria: N` mostrando quantos daquele bucket também compraram parceria.
  - O card "Contratos Pagos" mantém a exclusão de parceiros (regra core de "contratos novos") — sem mudança ali.

### Implementação

**1. `src/lib/carrinhoWeekBoundaries.ts`** — `getCarrinhoMetricBoundaries`
- `r2Meetings`, `aprovados`, `carrinhoOperacional` passam a usar `{ start: thuStart, end: wedEnd }` (mesma janela de `contratos`).
- `previousCutoff` / `safraOpeningCutoff` viram `thuStart` (Qui 00:00 desta safra) — usado só para classificar "semana anterior" no novo critério.
- `vendasParceria` permanece inalterado (Sex 00:00 → Seg 23:59).

**2. `src/hooks/useR2CarrinhoKPIs.ts`**
- Remover o `continue` que pula parceiros (linha ~182). Manter `partnerEmailsSet` apenas para:
  - Excluir do `contratosPagos` (já feito na query).
  - Calcular nova métrica `parceriaPorBucket` (contagem de parceiros em cada card).
- Adicionar campos no `R2CarrinhoKPIs`:
  - `parceriaR2Agendadas`, `parceriaR2Realizadas`, `parceriaNoShowR2`, `parceriaPendentes`, `parceriaAprovados`, `parceriaForaDoCarrinho`.
- Recalcular `semanasAnteriores*` usando o novo `previousCutoff` = Qui 00:00.

**3. `src/hooks/useR2PendingLeads.ts`** (linha ~398)
- O `previousCutoff` passado por `useR2CarrinhoKPIs` agora é Qui 00:00, então `pendentesAgendamentoSemanasAnteriores` automaticamente passa a refletir o novo critério (contrato pago em semana calendário anterior). Sem mudança de código.

**4. `src/hooks/useCarrinhoUnifiedData.ts`** (linhas 93-94)
- `p_previous_cutoff` agora será `thuStart` em vez do corte de sexta. Sem mudança de código (vem de `boundaries.carrinhoOperacional.start`).

**5. `src/pages/crm/R2Carrinho.tsx`**
- Em cada card de KPI, adicionar linha pequena "Parceria: N" (com mesmo estilo dos sub-badges ↩) quando N > 0.
- Atualizar tooltips: o de "Semanas Anteriores" precisa explicar o novo critério (semana calendário anterior, não corte de sexta). O do "Contratos Pagos" continua igual.

**6. `supabase/functions/weekly-manager-report/index.ts`** (linha 328+)
- Alinhar o `currentCutoff` / `previousCutoff` para Qui 00:00 / Qua 23:59 da semana, mantendo paridade com a UI.

**7. Memórias**
- Atualizar `mem://reporting/carrinho-safra-operational-logic-v6` → v7: nova janela fixa Qui→Qua, sem corte de sexta para safra.
- Atualizar `mem://business-logic/r2-carrinho-semanas-anteriores-criteria`: novo critério (contrato em semana calendário anterior).
- Adicionar memória nova `mem://business-logic/carrinho-parceria-indicator`: parceiros aparecem nos KPIs com indicador, mas seguem fora de "Contratos novos".
- Atualizar Core do índice: remover regra de "corte de sexta" se houver referência implícita.

### Pontos de atenção

- A configuração `dia_corte` / `horario_corte` continua existindo para a janela de **Vendas Parceria** (Sex 00:00 → Seg 23:59) e para o `getActiveCartReferenceDate` (qual safra exibir como ativa quando o usuário entra na página). Não vamos remover do schema, só não usaremos mais para definir a janela operacional do Carrinho.
- Vou validar que o card "Semanas Anteriores" cai para perto de 0 nesta semana (espera-se que só fique quem realmente tem R2 desta semana mas contrato de semana calendário anterior — provavelmente Bruno Cesar, Alexandre Donizete, Alexsandro Moreira, Mateus, Paulo Henrique etc., que apareciam nos sub-badges ↩ da safra de 24-30/04).

### Validação esperada após o deploy

Para a semana atual (30/04 → 06/05), card Contratos = **21**, e a soma deve fechar:
`R2 Realizadas + R2 Agendadas + No-Show + Pendentes + Reembolso (+ desistentes/fora se houver) = 21`.
Maria Isabel, Roberto Cezar, Baroli, Pri, Italo, Victor, Claudio Almeida, Giovana → todos contam como **safra atual** agora.
