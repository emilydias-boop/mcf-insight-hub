

## Implementar lógica de safra com R2 pós-contrato

### Campo oficial do contrato

O campo que representa a entrada do contrato na safra é **`sale_date`** da tabela `hubla_transactions`. Este é o campo já usado em ambos os relatórios para filtrar contratos (Qui-Qua). O campo `contract_paid_at` (em `meeting_slot_attendees`) é derivado do `sale_date` via webhook e usado para vinculação do attendee — mas a **fonte primária** da data do contrato é `sale_date`.

A comparação "R2 é posterior ao contrato" deve usar `tx.sale_date` do contrato da safra.

### Regras documentadas

```text
SAFRA DO CARRINHO (ex: carrinho sexta 28/03)
─────────────────────────────────────────────
Contratos da safra:  sale_date entre Qui 20/03 00:00 → Qua 26/03 23:59
R2 da safra:         vinculada ao lead do contrato, scheduled_at > sale_date
                     Classificação:
                       na_janela = scheduled_at dentro de Sex 21/03 → Sex 28/03
                       tardia    = scheduled_at > Sex 28/03
                       sem_r2    = nenhuma R2 após sale_date
R1 da safra:         mesma janela dos contratos (Qui-Qua)
Vendas parceria:     Sex 28/03 → Seg 31/03, matched ao lead da safra
```

### Mudanças por arquivo

#### 1. `src/hooks/useCarrinhoAnalysisReport.ts`
- **Remover filtro de data da query R2** (linhas 553-554: `.gte/.lte` de `boundaries.r2Meetings`) — buscar TODOS os R2 dos contacts da safra
- **Mudar seleção de R2 por lead** (linhas 821-836): em vez de pegar qualquer R2 do contact, filtrar apenas R2 com `scheduled_at > tx.sale_date`, ordenar crescente e pegar a primeira
- **Adicionar campo `r2Classificacao`** ao `LeadCarrinhoCompleto`: `'na_janela' | 'tardia' | 'sem_r2'`
  - `na_janela`: primeira R2 válida dentro de `boundaries.r2Meetings`
  - `tardia`: primeira R2 válida fora da janela
  - `sem_r2`: nenhuma R2 após `sale_date`
- **Adicionar KPIs** `r2NaJanela` e `r2Tardia` ao retorno
- **Mudar `mergeR2IntoMap`** para guardar TODAS as R2 do contact (não só a mais recente), permitindo a seleção posterior

#### 2. `src/hooks/useR2CarrinhoKPIs.ts`
- **Migrar R2 para lógica de safra**:
  - Dos contratos (já buscados), extrair emails → buscar `crm_contacts` → `contact_ids`
  - Buscar `meeting_slot_attendees` desses contacts com `meeting_type='r2'` (sem filtro de data)
  - Para cada contrato: filtrar R2 com `scheduled_at > sale_date`, pegar a primeira
  - Classificar com `boundaries.r2Meetings` e contar KPIs

#### 3. `src/hooks/useR2CarrinhoData.ts`
- Manter janela `boundaries.r2Meetings` para a lista visual (o que aparece na tela)
- Adicionar verificação: se o attendee tem `contract_paid_at`, só incluir se `scheduled_at >= contract_paid_at`

#### 4. `src/hooks/useR2ForaDoCarrinhoData.ts`
- Mesma verificação de `scheduled_at >= contract_paid_at`

#### 5. `src/hooks/useR2MetricsData.ts`
- Alinhar: buscar R2 dos leads da safra, aplicando mesma regra de pós-contrato

#### 6. `src/hooks/useSDRCarrinhoMetrics.ts` e `src/hooks/useCloserCarrinhoMetrics.ts`
- Buscar aprovados da safra: contratos → contacts → R2 pós-contrato

#### 7. `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`
- Exibir KPIs "R2 Na Janela" e "R2 Tardia"
- Na tabela, mostrar badge de classificação temporal

#### 8. `.lovable/plan.md`
- Documentar as regras definitivas da safra para referência futura

### Arquivos alterados
1. `src/hooks/useCarrinhoAnalysisReport.ts`
2. `src/hooks/useR2CarrinhoKPIs.ts`
3. `src/hooks/useR2CarrinhoData.ts`
4. `src/hooks/useR2ForaDoCarrinhoData.ts`
5. `src/hooks/useR2MetricsData.ts`
6. `src/hooks/useSDRCarrinhoMetrics.ts`
7. `src/hooks/useCloserCarrinhoMetrics.ts`
8. `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`
9. `.lovable/plan.md`

