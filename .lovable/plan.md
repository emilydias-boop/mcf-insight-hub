

## Alinhar janelas de data por tipo de métrica entre Carrinho R2 e Análise

### Problema raiz
Cada relatório usa uma definição de semana diferente e aplica a mesma janela para TODAS as métricas — mas o ciclo operacional do carrinho tem janelas diferentes por tipo de dado:

```text
CICLO DO CARRINHO (exemplo: carrinho dia 27/03 sexta)
──────────────────────────────────────────────────────
Contratos:    Qui 20/03 ──────── Qua 26/03  (vendas ANTES do carrinho)
R2 Agendadas: Sex 21/03 (pós-carrinho anterior) ── Sex 28/03 (pré-carrinho)
Vendas Parceria: Sex 27/03 (pós-pitch) ── Seg 30/03
R1 Realizadas: mesma janela dos contratos (Qui-Qua)
```

**Hoje**: Carrinho R2 (CRM) usa Sáb-Sex para TUDO. Análise usa Qui-Qua para TUDO. Por isso 295 R1 vs 174, 33 R2 vs 37, etc.

### Solução: Janelas específicas por métrica

#### 1. Criar helper `getCarrinhoMetricBoundaries` em `src/lib/carrinhoWeekBoundaries.ts`

Nova função que recebe a semana-âncora (Thu-Wed) e o `horario_corte` da config, e retorna janelas específicas:

```typescript
interface CarrinhoMetricBoundaries {
  contratos: { start: Date; end: Date };      // Qui 00:00 → Qua 23:59
  r2Meetings: { start: Date; end: Date };      // Sex (pós-corte anterior) → Sex (pré-corte atual)
  vendasParceria: { start: Date; end: Date };  // Sex (pós-pitch) → Seg 23:59
  r1Meetings: { start: Date; end: Date };      // Mesma janela dos contratos
}
```

#### 2. Alinhar Carrinho R2 (CRM) para semana Qui-Qua
**Arquivo: `src/pages/crm/R2Carrinho.tsx`**

Trocar `getCustomWeekStart/End` (Sáb-Sex) por `getCartWeekStart/End` (Qui-Qua) — mesma função já usada na Análise.

#### 3. Aplicar janelas específicas no `useR2CarrinhoKPIs.ts`

- **Contratos pagos**: usar `boundaries.contratos` (Qui-Qua)
- **R2 Agendadas/Realizadas**: usar `boundaries.r2Meetings` (Sex-Sex, respeitando horário_corte)
- **R1 Realizadas**: usar `boundaries.r1Meetings` (Qui-Qua)

#### 4. Aplicar mesmas janelas no `useCarrinhoAnalysisReport.ts`

- Contratos: `boundaries.contratos`
- R2 query: `boundaries.r2Meetings`
- Total R1 realizadas: `boundaries.r1Meetings`

#### 5. Ajustar `useR2CarrinhoData.ts` e `useR2ForaDoCarrinhoData.ts`

Usar `boundaries.r2Meetings` para as queries de R2 meetings, alinhando com os KPIs.

### Resultado esperado (semana do carrinho 27/03)

| Métrica | Janela | Carrinho R2 | Análise |
|---------|--------|-------------|---------|
| Contratos | Qui 20 → Qua 26 | 60 | 60 |
| R1 Realizadas | Qui 20 → Qua 26 | 174 | 174 |
| R2 Agendadas | Sex 21 → Sex 28 | ~46 | ~46 |
| Taxa C/R1 | — | 34% | 34% |

### Arquivos alterados
1. `src/lib/carrinhoWeekBoundaries.ts` — nova função `getCarrinhoMetricBoundaries`
2. `src/pages/crm/R2Carrinho.tsx` — trocar Sáb-Sex por Qui-Qua
3. `src/hooks/useR2CarrinhoKPIs.ts` — usar janelas por métrica
4. `src/hooks/useR2CarrinhoData.ts` — usar janela R2
5. `src/hooks/useR2ForaDoCarrinhoData.ts` — usar janela R2
6. `src/hooks/useCarrinhoAnalysisReport.ts` — usar janelas por métrica
7. `src/hooks/useR2CarrinhoVendas.ts` — usar janela vendas (se existir)

