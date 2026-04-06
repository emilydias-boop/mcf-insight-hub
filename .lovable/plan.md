

# Alinhar Detail do Consórcio com o padrão do Incorporador

## Problema

A página de detalhe do fechamento de Closers Consórcio (`ConsorcioFechamentoDetail`) é muito mais simples que a do Incorporador (`FechamentoSDRDetail`):

- **Incorporador**: Usa `KpiEditForm` com campos editaveis, badges Auto/Manual, botao "Salvar e Recalcular", `DynamicIndicatorsGrid` com barras de progresso, faixas (86-99%), multiplicadores visuais, exportar CSV
- **Consórcio**: Usa `ConsorcioIndicatorCard` basico (grid 5 colunas plano) e `ConsorcioKpiForm` separado sem contexto visual

## Solucao

Refatorar `ConsorcioFechamentoDetail` para reutilizar os mesmos componentes visuais do Incorporador, adaptando os dados do `consorcio_closer_payout` para o formato esperado.

### Arquivo 1: `src/pages/bu-consorcio/FechamentoDetail.tsx`

Reescrever para seguir o mesmo padrao do `Detail.tsx` do Incorporador:

1. **Header**: Mesmo layout com nome, badge status, badge "Closer", botoes Exportar/Aprovar/Travar/Reabrir
2. **Summary Cards**: Grid 6 colunas (OTE, Fixo, Variavel com badge Recalcular, Total Conta, iFood Mensal, iFood Ultrameta)
3. **KPI Edit Form**: Reutilizar `KpiEditForm` adaptado — mapear campos do consorcio (`comissao_consorcio`, `comissao_holding`, `score_organizacao`) para o formato do KpiEditForm, ou criar um `ConsorcioKpiEditForm` que siga o mesmo padrao visual (campos com badges Auto/Manual, subtitulos de meta, botao "Salvar e Recalcular")
4. **Indicadores Dinamicos**: Usar `DynamicIndicatorsGrid` com as metricas ativas do closer (comissao_consorcio, comissao_holding, organizacao) — mapear o payout consorcio para o formato `SdrMonthPayout`/`SdrMonthKpi`
5. **Ajustes**: Mesmo layout de 2 colunas (form + historico)
6. **Export**: CSV individual como no Incorporador

### Arquivo 2: `src/components/consorcio-fechamento/ConsorcioKpiEditForm.tsx` (novo)

Criar formulario de KPI no padrao visual do `KpiEditForm`:
- Campos com labels, badges "Manual", subtitulos de meta/agenda
- Campo Comissao Consorcio (R$) + Meta Comissao Consorcio
- Campo Comissao Holding (R$) + Meta Comissao Holding  
- Campo Score Organizacao (0-100) com badge "Manual"
- Botao verde "Salvar e Recalcular"

### Arquivo 3: Adaptar DynamicIndicatorCard para metricas de currency

O `DynamicIndicatorCard` ja suporta `comissao_consorcio` e `comissao_holding` no `METRIC_CONFIG`. Porem precisa:
- Tratar formatacao de valores monetarios grandes (R$ 19.000.000 → R$ 19M)
- Garantir que o `getMultiplier` usado seja o do consorcio (faixas diferentes: 0-70%=0, 71-85%=0.5, etc.)

### Arquivo 4: Hook de mapeamento

Criar funcao utilitaria que converte `ConsorcioCloserPayout` → formato compativel com `SdrMonthPayout` + `SdrMonthKpi`, para que os componentes compartilhados funcionem sem alteracao.

## Resultado esperado

- Victoria Paz (Closer Consorcio) tera a mesma UI rica que Cristiane Gomes (Closer Incorporador)
- Barras de progresso com faixas coloridas (0-70%, 71-85%, 86-99%, 100-119%, 120%+)
- Badges Auto/Manual nos campos
- Botao "Salvar e Recalcular" verde
- Cards de resumo no topo com badge "Recalcular" quando valores divergem
- Exportar CSV individual

## Arquivos alterados
1. `src/pages/bu-consorcio/FechamentoDetail.tsx` — reescrever com layout do Incorporador
2. `src/components/consorcio-fechamento/ConsorcioKpiEditForm.tsx` — novo form no padrao visual
3. `src/components/fechamento/DynamicIndicatorCard.tsx` — suporte a currency formatting e multiplier consorcio

