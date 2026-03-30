

## Consolidar dados entre Carrinho R2 e Análise de Carrinho

### Problema
Os três relatórios (Carrinho R2, Análise de Carrinho, Painel Comercial) usam filtros e fronteiras de data diferentes, gerando números inconsistentes para as mesmas métricas.

### Correções necessárias

#### 1. Unificar filtro de contratos pagos
**Arquivo: `src/hooks/useR2CarrinhoKPIs.ts`**

Alinhar o filtro de contratos com a Análise:
- Trocar `ilike('product_name', '%A000%')` por `.eq('product_name', 'A000 - Contrato')`
- Adicionar `.in('sale_status', ['completed', 'refunded'])` 
- Adicionar `.in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])`
- Excluir `hubla_id LIKE 'newsale-%'` (filtrar client-side)
- Excluir `installment_number > 1` (filtrar client-side)
- Contar reembolsos separadamente para exibir "72 (2 reco)"

#### 2. Unificar fronteiras de data
**Arquivo: `src/hooks/useCarrinhoAnalysisReport.ts`**

Usar `getCarrinhoWeekBoundaries` na Análise também, em vez do formato string atual. Isso garante que ambos os relatórios usem a mesma janela Sab→Sex.

Trocar:
```typescript
.gte('sale_date', startStr)
.lte('sale_date', endStr + 'T23:59:59')
```
Por:
```typescript
const { effectiveStart, effectiveEnd } = getCarrinhoWeekBoundaries(startDate, endDate);
.gte('sale_date', effectiveStart.toISOString())
.lt('sale_date', effectiveEnd.toISOString())
```

#### 3. R2 Agendadas na Análise — restringir à semana
**Arquivo: `src/hooks/useCarrinhoAnalysisReport.ts`**

Na query de R2 attendees (linha ~538), adicionar filtro de data para contar apenas R2s agendadas dentro da mesma semana:
```typescript
.gte('meeting_slots.scheduled_at', effectiveStart.toISOString())
.lt('meeting_slots.scheduled_at', effectiveEnd.toISOString())
```

Isso alinha com o Carrinho R2 que só conta R2 da semana.

#### 4. Adicionar métricas cruzadas na Análise
**Arquivo: `src/hooks/useCarrinhoAnalysisReport.ts`** e **`src/components/relatorios/CarrinhoAnalysisReportPanel.tsx`**

Adicionar KPIs que respondem às perguntas do usuário:
- **Total R1 Realizadas (semana)**: Query separada buscando TODAS as R1 realizadas na semana (não apenas dos que compraram)
- **Taxa Contrato/R1**: `contratosPagos / totalR1Realizadas * 100`
- **Gap R2**: Quantos compraram mas não têm R2 e por quê (já existe, mas precisa ser consistente)
- **Breakdown Aprovados**: Quantos aprovados compraram parceria vs não

### Arquivos alterados
1. `src/hooks/useR2CarrinhoKPIs.ts` — unificar filtros de contratos
2. `src/hooks/useCarrinhoAnalysisReport.ts` — usar mesmas fronteiras de data, restringir R2 à semana, adicionar R1 totais da semana
3. `src/components/relatorios/CarrinhoAnalysisReportPanel.tsx` — exibir novos KPIs (Taxa Contrato/R1, breakdown aprovados)

