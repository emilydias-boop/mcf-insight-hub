

## Análise do Módulo de Cobranças — O que está faltando

Após revisar todos os componentes, hooks, dados no banco e a screenshot, identifiquei as seguintes lacunas:

---

### 1. Atualização automática de status das parcelas (CRÍTICO)

Existem **1.254 parcelas com status "atrasado"** no banco, mas o sistema **não atualiza automaticamente** parcelas vencidas de "pendente" para "atrasado". O `sync-billing-from-hubla` cria parcelas como "pendente" com data de vencimento futura, mas **não existe job ou trigger** que reclassifique parcelas vencidas.

**Fix**: Adicionar lógica no `useBillingMonthKPIs` e no `useBillingSubscriptions` (ou um cron/trigger no DB) que marca parcelas com `data_vencimento < hoje` e `status = 'pendente'` como `'atrasado'`. Igualmente, atualizar o status da subscription de `'em_dia'` para `'atrasada'` quando houver parcela atrasada.

---

### 2. Nenhum dado em `responsavel_financeiro` (0 de 709)

A coluna existe no banco e no filtro, mas **nenhuma assinatura tem responsável preenchido**. O sync da Hubla não popula este campo. Na tabela, a coluna "Responsável" mostra "-" para todos.

**Fix**: Mapear o `responsavel_financeiro` durante o sync (ex: usar o vendedor/SDR do deal se disponível via `deal_id`) ou permitir atribuição em massa na UI.

---

### 3. `deal_id` e `contact_id` nunca populados (0 de 709)

Não há link entre a assinatura de cobrança e o CRM. Isso impede cruzar dados (ex: ver o deal no drawer da cobrança, ou ver cobranças no drawer do deal).

**Fix**: No `sync-billing-from-hubla`, fazer match por `customer_email` com `crm_contacts.email` para popular `contact_id`, e buscar o deal correspondente para `deal_id`.

---

### 4. Filtro por produto/categoria ausente

Na screenshot, vejo assinaturas de vários produtos (A005, A000, A009, A010, etc.) mas **não há filtro por produto ou categoria/BU** na `CobrancaFilters`. Para 709 assinaturas, isso é essencial.

**Fix**: Adicionar select de Produto e Categoria (BU) no `CobrancaFilters`.

---

### 5. Sem paginação server-side (performance)

O `useBillingSubscriptions` faz `select('*')` em **todas as 709 assinaturas** e a paginação é client-side. Com crescimento, isso vai degradar.

**Fix**: Adicionar `.range()` no query do Supabase e passar `page`/`pageSize` ao hook.

---

### 6. Sem exportação (CSV/Excel)

Para o time financeiro, **exportar a lista de inadimplentes** ou parcelas atrasadas é operação básica. Não existe nenhum botão de exportação.

**Fix**: Adicionar botão "Exportar CSV" que gera download dos dados filtrados.

---

### 7. Drawer não mostra telefone/WhatsApp do cliente

O drawer mostra nome e email, mas **não exibe o telefone** (`customer_phone`), que é essencial para o time de cobrança entrar em contato.

**Fix**: Exibir `customer_phone` no header do drawer com link `tel:` ou `wa.me`.

---

### 8. Sem link "Cobrar via WhatsApp"

Para o fluxo operacional de cobrança, falta um botão rápido de "Enviar cobrança" que abra o WhatsApp com mensagem pré-formatada (nome, valor, parcela, PIX).

---

### 9. `data_fim_prevista` nunca calculada (0 de 709)

O campo existe mas nunca é preenchido. Deveria ser calculado automaticamente com base na última parcela.

---

### Plano de implementação (priorizado)

| # | Item | Arquivo(s) | Impacto |
|---|---|---|---|
| 1 | Auto-atualizar status atrasado | `useBillingMonthKPIs.ts`, novo cron ou trigger SQL | KPIs e tabela ficam corretos |
| 2 | Exibir telefone + link WhatsApp no drawer | `CobrancaDetailDrawer.tsx` | Time consegue cobrar |
| 3 | Filtro por produto/categoria | `CobrancaFilters.tsx`, `useBillingSubscriptions.ts` | Navegação eficiente |
| 4 | Popular `contact_id`/`deal_id` no sync | `sync-billing-from-hubla/index.ts` | Link CRM ↔ Cobrança |
| 5 | Exportar CSV | `FinanceiroCobrancas.tsx` (novo botão + lógica) | Operação financeira |
| 6 | Paginação server-side | `useBillingSubscriptions.ts`, `CobrancaTable.tsx` | Performance |
| 7 | Calcular `data_fim_prevista` no sync | `sync-billing-from-hubla/index.ts` | Dados completos |
| 8 | Botão "Cobrar WhatsApp" com mensagem pré-formatada | `CobrancaDetailDrawer.tsx` ou `CobrancaInstallments.tsx` | Produtividade cobrança |

