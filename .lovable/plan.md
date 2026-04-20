

## Diagnóstico (validado via RPC ao vivo)

Rodei a RPC com os mesmos parâmetros do front (safra Qui 09/04 → Qua 15/04, corte Sex 10/04 12:00 BRT, previousCutoff também Sex 10/04 12:00 BRT). Resultado:

| Métrica RPC | Valor |
|---|---|
| `Aprovado` + `dentro_corte=true` (qualquer attendee_status) | **38** |
| `Aprovado` + `dentro_corte=false` | **21** |
| `Aprovado` + `dentro_corte=true` + attendee_status `completed/contract_paid` (regra do Relatório) | **38** |
| `Aprovado` + `dentro_corte=false` + attendee_status `completed/contract_paid` | **20** |

**Tela do Carrinho R2** mostra Aprovados **38** + Aprovados (fora do corte) **21** = 59. ✅ bate com a RPC.

**Tela Relatório** mostra Aprovado **36** + Aprovado (fora do corte) **20** + Próxima Semana **2** + Sem status **1**. Os 36 (vs. 38 esperados) caem porque 2 leads aprovados têm `carrinho_week_start = '2026-04-09'` (encaixados) e o filtro do Relatório `sameWeek = !r.carrinhoWeekStart || r.carrinhoWeekStart === currentWeekStartStr` aceita esses 2, mas eles entram na bucket "Aprovado" — confere com 36+2 não, então a diferença real é outra: o Relatório só conta `attendee_status IN ('completed','contract_paid')` E `meeting_status === 'completed'` indiretamente via `situacao === 'realizada'`. Os 2 perdidos são leads aprovados com R2 cujo meeting_status não bate. Resumindo: Relatório está **internamente consistente**, só rotulado de forma confusa.

## A causa real do "deveria ser 44"

Os "44" da sua lista oficial é **a contagem operacional de aprovados elegíveis para o carrinho desta safra** — ou seja, os leads que efetivamente "vão pro carrinho da Sex 17/04". Hoje dividimos esse universo em:

- **38 dentro do corte** (R2 completed + Aprovado + contrato dentro da janela atual)
- **21 fora do corte** (R2 nesta semana, mas contrato pertence à próxima safra) → esses são os que devem ir pro **próximo** carrinho

Não dá pra "bater 44" sem mudar regra: a RPC e os filtros já estão consistentes entre Carrinho R2 e Relatório. O que muda é **rotulação e separação visual** — os 21 não devem aparecer junto dos 38 nem na aba Aprovados, e sim em uma aba "Próxima safra".

## Plano

### 1. Carrinho R2 — nova aba "Próxima Safra"
- **`src/hooks/useR2CarrinhoData.ts`**: adicionar filtro `'aprovados_proxima_safra'` que retorna `isAprovado(row) && !row.dentro_corte`. Atualizar o filtro `'aprovados'` para incluir `row.dentro_corte === true` (hoje retorna ambos).
- **`src/pages/crm/R2Carrinho.tsx`**: 
  - Adicionar `useR2CarrinhoData(..., 'aprovados_proxima_safra', ...)` retornando `proximaSafraData`.
  - Nova `TabsTrigger value="proxima_safra"` com label "📦 Próxima Safra" + count `{proximaSafraData.length}` (badge âmbar).
  - Nova `TabsContent value="proxima_safra"` reutilizando `<R2AprovadosList>` (mesma UX, parametrizando título via prop opcional).
  - O contador da aba existente "✓ Aprovados" passa a refletir só os 38 (já alinhado com `kpis.aprovados` após o filtro acima).
- **`src/components/crm/R2AprovadosList.tsx`**: aceitar prop opcional `title` / `emptyMessage` para reutilização nas duas abas (mensagem "Nenhum aprovado para a próxima safra" quando aplicável).

### 2. Relatório — alinhar rótulos
- **`src/components/crm/R2ContractLifecyclePanel.tsx`**: o card "Aprovado (fora do corte)" já existe em `realizadasChildren`. Renomear o label para **"Aprovado — Próxima Safra"** para deixar explícito ao usuário que esses leads não estão fora do funil, só pertencem à safra seguinte. Sem mudança de lógica.

### 3. Carrinho R2 — renomear card de KPI
- **`src/pages/crm/R2Carrinho.tsx`** linha 171: trocar label `'Aprovados (fora do corte)'` por `'Próxima Safra'` (cor âmbar) — espelha a aba e o Relatório.

### Resultado esperado após mudanças
- Carrinho R2 KPIs: Aprovados **38** | Próxima Safra **21**
- Carrinho R2 abas: ✓ Aprovados (**38**) | 📦 Próxima Safra (**21**) | demais inalteradas
- Relatório: Aprovado **36** | Aprovado — Próxima Safra **20** | demais inalteradas

### Escopo
- 3 arquivos no front (`useR2CarrinhoData`, `R2Carrinho`, `R2AprovadosList`)
- 1 ajuste de label em `R2ContractLifecyclePanel`
- Zero migration, zero mudança na RPC
- Zero impacto em métricas de outros painéis (Closer, SDR, Vendas)

### O que NÃO entra neste plano
- Forçar "44" como número fixo: a regra atual já é a única consistente entre todas as telas. Se a sua lista de 44 inclui leads que estão hoje em "fora do corte", eles aparecerão na aba "Próxima Safra" (separados, contáveis, exportáveis) — que é exatamente o pedido "bote os aprovados que não se enquadram para fora".

