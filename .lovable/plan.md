

## Encaixar "Próxima Safra" — coesão entre Carrinho R2 e Agenda R2 → Relatório

### Contexto

Hoje existem dois lugares que lidam com leads aprovados cujo contrato caiu depois do corte (vão para a próxima safra):

| Tela | O que mostra hoje | Tem Encaixar? |
|---|---|---|
| **Carrinho R2** → aba "📦 Próxima Safra" (10 leads) | Lista de aprovados fora do corte (via `isProximaSafra`) usando `R2AprovadosList` | ❌ Não |
| **Agenda R2** → aba "Relatório" → KPI "Pendentes" | Children "Recentes (≤3d) / Antigos (>3d)". Tabela mostra badge "R2 próx. semana" no motivo | ❌ Não |
| **Carrinho R2** → aba "Acumulados" | Leads de semanas anteriores que precisam ser resgatados | ✅ Sim (via `useEncaixarNoCarrinho`) |

**A mutation `useEncaixarNoCarrinho` já funciona para qualquer `attendee_id`** — seta `carrinho_week_start` para a semana atual e força `r2_status_id = Aprovado`. Basta expor o botão nos dois lugares.

### O que vamos entregar

**1. Novo child "📦 Próxima Safra" dentro da KPI "Pendentes" do Relatório (Agenda R2)**

Em `R2ContractLifecyclePanel.tsx` adicionar um 3º card filho ao lado de "Recentes" / "Antigos":

```
Pendentes (expandido)
┌──────────────┬──────────────┬───────────────────────┐
│ Recentes ≤3d │ Antigos >3d  │ 📦 Próxima Safra  10  │
└──────────────┴──────────────┴───────────────────────┘
```

- Filtro: `situacao === 'pendente'` **E** `pendingReason === 'r2_proxima_semana'` (estes são exatamente os leads mostrados com o badge "R2 próx. semana 20/04" na tabela)
- Ao clicar, filtra a tabela apenas para eles
- Contagem mostrada no badge

**2. Coluna "Ação" na tabela do Relatório quando o filtro "Próxima Safra" estiver ativo**

Adicionar condicionalmente uma coluna extra ao final da tabela com botão **"Encaixar nesta semana"** para cada linha. Só aparece quando `activeSubFilter === 'proxima_safra'`.

- Clique → chama `useEncaixarNoCarrinho` com `attendeeId = row.id` (o attendee_id do R2 futuro) e `weekStart = safraStart` da semana atual
- Estado de loading por linha (`encaixandoId`)
- Toast "Lead encaixado no carrinho da semana!" (já existe no hook)
- Invalida queries: `carrinho-unified-data`, `r2-carrinho-kpis`, `r2-carrinho-data`, `contract-lifecycle-report`, `r2-accumulated-leads`

**3. Botão "Encaixar nesta semana" na aba "📦 Próxima Safra" do Carrinho R2**

Em `R2AprovadosList.tsx`, quando `countLabel === 'próxima safra'` (já é passada como prop pelo `R2Carrinho.tsx`):

- Adicionar coluna "Encaixar" na tabela (ou botão na coluna Ações existente)
- Mesmo hook `useEncaixarNoCarrinho({ attendeeId: att.id, weekStart })`
- Depois do encaixe, o lead sai da aba "Próxima Safra" e aparece na aba "Aprovados" (comportamento natural, pois `isProximaSafra()` checa `dentro_corte === false` e o encaixe seta `carrinho_week_start = semana atual`, fazendo o RPC reclassificar)

Obs: a aba "Aprovados" (sem `countLabel`) **não** ganha esse botão — só a "Próxima Safra".

**4. Coesão bidirecional (automática via React Query)**

Já que ambas as telas compartilham fontes:

- `R2ContractLifecyclePanel` usa `useContractLifecycleReport` → query `['contract-lifecycle-report', ...]`
- `R2AprovadosList` (via R2Carrinho) usa `useR2CarrinhoData` / `useCarrinhoUnifiedData` → queries `['carrinho-unified-data', ...]` e `['r2-carrinho-data', ...]`

Basta adicionar `['contract-lifecycle-report']` à lista de invalidações do `useEncaixarNoCarrinho.onSuccess`. Qualquer clique em um dos dois lugares dispara refetch automático nos dois — o usuário vê a mudança refletida imediatamente ao voltar para a outra aba.

### Por que diferenciar "Próxima Safra" (10) de "R2 próx. semana" (pendentes)

São **a mesma coisa** visto por dois ângulos:

- No **Carrinho R2**, olhamos pelo viés do R2 desta semana: "tem R2 marcado aqui, está aprovado, mas o contrato é da próxima safra" → conta em `isProximaSafra`.
- No **Relatório**, olhamos pelo viés do contrato: "contrato pago nesta safra, status pendente, porém encontramos um R2 futuro para ele" → `pendingReason = 'r2_proxima_semana'`.

O número pode divergir em casos de borda (ex: contrato com R2 futuro mas ainda sem aprovação), então **não vamos forçar que os contadores sejam iguais** — cada tela mantém seu recorte. Mas o botão "Encaixar" funciona igual nos dois lados e o resultado é visível em ambos.

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/crm/R2ContractLifecyclePanel.tsx` | + card filho "Próxima Safra" em Pendentes, + coluna Ação condicional com botão Encaixar, + chamada ao `useEncaixarNoCarrinho` |
| `src/components/crm/R2AprovadosList.tsx` | + prop `showEncaixarButton?: boolean` + botão "Encaixar" na última coluna quando ativo |
| `src/pages/crm/R2Carrinho.tsx` | Passar `showEncaixarButton={true}` apenas para a aba "Próxima Safra" |
| `src/hooks/useEncaixarNoCarrinho.ts` | + `queryClient.invalidateQueries({ queryKey: ['contract-lifecycle-report'] })` no `onSuccess` |

### Validação

1. Carrinho R2 → aba Próxima Safra → clicar "Encaixar" num dos 10 leads → ele some da aba, aparece em "Aprovados" da mesma semana, com badge "Encaixado"
2. Agenda R2 → Relatório → KPI Pendentes → clicar → aparecer 3º card "📦 Próxima Safra" com contagem
3. Clicar no card → tabela filtra → coluna Ação aparece com botão Encaixar
4. Encaixar um lead aqui → refletir imediatamente na aba "Aprovados" do Carrinho R2
5. Vice-versa: encaixar no Carrinho R2 → o lead some do sub-filtro "Próxima Safra" do Relatório

### Escopo

- 4 arquivos editados, zero migrations, zero RLS
- Reutiliza `useEncaixarNoCarrinho` existente (nenhuma nova mutation)
- Zero impacto em métricas/distribuição

