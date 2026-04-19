

## Diagnóstico revisado: "Proposta Enviada" ≠ "Produto Fechado"

Você está certo — não posso espelhar `PRODUTOS FECHADOS` como Proposta. São eventos distintos: o closer envia várias propostas e só algumas viram fechamento. Contar igual quebra a Taxa de Conversão.

### O sinal real de "Proposta Enviada" hoje

Investigando o banco:

| Fonte | O que é | Status |
|---|---|---|
| `consorcio_proposals` | Criada via aba Pós-Reunião → botão "Proposta" | Parou em 12/mar (time abandonou) |
| Stage `PROPOSTA ENVIADA` (VdA) | Move manual no Kanban | 0 em abril |
| Stage `PRODUTOS FECHADOS` (EA) | Fechamento, não proposta | 49 em abril ❌ não serve |

**Não existe hoje, no fluxo Efeito Alavanca, NENHUM sinal de "proposta enviada" sendo registrado.** O closer fecha direto, sem trilha.

### Caminho correto

**1. Propostas Enviadas = somente sinais reais de proposta**

Hook `useConsorcioPipelineMetricsByCloser.ts` passa a contar (DISTINCT por `deal_id`):
- (a) Registros em `consorcio_proposals` criados no período (qualquer status)
- (b) Deals movidos para stage `PROPOSTA ENVIADA` (VdA) no período

**Não conta** `PRODUTOS FECHADOS` como proposta. Para fluxo EA, Propostas pode ficar 0 — é a realidade: não há registro.

Mapeamento closer:
- (a) via `consorcio_proposals.created_by` → user → `closers`
- (b) via `crm_deals.owner_id` (email) → `closers.email`, com fallback para `meeting_slot_attendees`

**2. Produtos Fechados = sinais de fechamento real**

Hook `useConsorcioProdutosFechadosByCloser.ts` passa a contar (DISTINCT por `deal_id`):
- (a) Registros em `deal_produtos_adquiridos` no período (cota cadastrada via fluxo)
- (b) Deals em stages de fechamento Consórcio movidos no período:
  - VdA: `VENDA REALIZADA`, `CONTRATO PAGO`
  - EA: `PRODUTOS FECHADOS`, `VENDA REALIZADA 50K`

Mapeamento closer: igual acima.

**3. Taxa de Conversão fica honesta**
- Produtos Fechados / R1 Realizada (não usa Propostas no denominador, evita distorção EA)
- Para João Pedro abril: 49/79 ≈ 62% ✅

**4. Aplicar mesma lógica nos hooks de equipe** para consistência:
- `useConsorcioProdutosFechadosBySdr.ts` → adicionar fonte CRM stages
- `useConsorcioProdutosFechadosMetrics.ts` → idem
- `useConsorcioPipelineMetricsBySdr.ts` → manter só Propostas reais
- `useConsorcioPipelineMetrics.ts` → idem

**5. Tooltip nos cards** (`CloserConsorcioDetailKPICards.tsx`):
- Propostas Enviadas: "Conta proposta criada na aba Pós-Reunião + stage PROPOSTA ENVIADA (Viver de Aluguel). Fluxo Efeito Alavanca não possui etapa de proposta."
- Produtos Fechados: "Conta cota cadastrada + stages PRODUTOS FECHADOS / VENDA REALIZADA / CONTRATO PAGO."

### Resultado esperado para João Pedro (abril/2026)

| Métrica | Antes | Depois | Honesto? |
|---|---|---|---|
| R1 Realizada | 79 | 79 | ✅ |
| **Propostas Enviadas** | 0 | **0** (EA não registra) | ✅ reflete realidade |
| **Produtos Fechados** | 0 | **49** | ✅ |
| **Taxa Conversão** | 0% | **62%** (49/79) | ✅ |

### Observação para a equipe (fora do escopo deste fix)

Se quiserem rastrear Propostas Enviadas no fluxo EA, há duas saídas (decisão futura):
- Criar stage "PROPOSTA ENVIADA" também na pipeline EA + treinar time a mover
- Voltar a usar a aba Pós-Reunião como obrigatória (que já alimenta `consorcio_proposals`)

Sem uma dessas, EA continuará com Propostas = 0 — e isso é o dado real, não bug.

### Garantias

- Sem alteração de banco
- Aba Pós-Reunião continua funcionando
- Fluxo Kanban-direto agora aparece em Produtos Fechados
- Sem duplicação (DISTINCT por `deal_id`)
- Taxa de Conversão usa Produtos/R1 Realizada (não depende de Propostas)
- Sem impacto em Incorporador

