

## Adicionar filtros extras ao SalesReportPanel

**Situação atual:** Os filtros existentes incluem Período (range), Busca, Fonte, Closer R1, Pipeline e Canal. Faltam: **filtro por SDR**, **filtro por Closer R2**, e **atalhos de data** (Hoje, Semana, Mês).

### Mudanças em `src/components/relatorios/SalesReportPanel.tsx`

**1. Novo state + filtro por SDR**
- Adicionar `selectedSdr` state (`'all'` default)
- Derivar lista de SDRs únicos a partir de `sdrByEmail` + `classifiedByTxId` (nomes reais, sem labels automáticos)
- No `filteredTransactions`, se `selectedSdr !== 'all'`, filtrar transações cujo SDR enriquecido (`getEnrichedData`) corresponda ao nome selecionado

**2. Novo state + filtro por Closer R2**
- Adicionar `selectedCloserR2` state (`'all'` default)
- Usar `r2Closers` (já carregados) como opções
- No `filteredTransactions`, se `selectedCloserR2 !== 'all'`, filtrar por `r2CloserByEmail` match

**3. Atalhos de data (Hoje / Semana / Mês / Custom)**
- Adicionar botões de preset acima ou ao lado do DatePickerCustom
- "Hoje" → `from = today, to = today`
- "Semana" → `startOfWeek(today) ... endOfWeek(today)`
- "Mês" → `startOfMonth(today) ... endOfMonth(today)` (já é o default)
- "Custom" → abre o DatePickerCustom (comportamento atual)
- State `datePreset` para highlight visual do botão ativo

**4. Reorganizar layout dos filtros**
- Primeira linha: atalhos de data + DatePickerCustom + Busca
- Segunda linha: SDR, Closer R1, Closer R2, Canal, Pipeline, Fonte, botão Excel
- Botão "Limpar filtros" quando há filtros ativos

**5. Reset de página**
- Adicionar `selectedSdr` e `selectedCloserR2` ao memo que reseta `currentPage`

