## Objetivo
Trocar o seletor único de **Grupo** na aba Contemplação por um **multi-select**, para consultar várias cotas de grupos diferentes em uma só rodada (ex.: 9935 + outros que tenham assembleia no mesmo dia).

## Mudanças

### 1. `src/components/consorcio/ContemplationTab.tsx`
- Substituir o state `consultaGrupo: string` por `consultaGrupos: string[]`.
- Trocar o `<Select>` de Grupo por um componente multi-select baseado em `Popover` + `Command` + `Checkbox` (padrões já usados no projeto via shadcn). Mostra:
  - Campo com placeholder "Selecione os grupos" e contagem ("3 grupos selecionados") quando há seleção, com chips/badges removíveis abaixo.
  - Lista rolável com busca por número de grupo e opção "Selecionar todos / Limpar".
- `canCalculate` passa a exigir `consultaGrupos.length > 0`.
- `handleCalcular` e `registrarConsulta` passam o array (ou string concatenada `"9935,7249"` para o log, mantendo compatibilidade do registro).
- Histórico do grupo (`HistoricoAssembleiaPanel`):
  - Se 1 grupo selecionado → render igual hoje.
  - Se 2+ → render um painel por grupo em accordion (`Accordion` shadcn) para não poluir.
- Tabela de resultados ganha header já existente "Grupo" (continua igual, mas agora pode misturar vários).

### 2. `src/hooks/useContemplacao.ts`
- Em `ContemplationFilters`, adicionar `grupos?: string[]` (manter `grupo` por compat, mas Contemplation passará a usar `grupos`).
- Em `useContemplationCards`, se `filters.grupos?.length` aplicar `query.in('grupo', filters.grupos)`; senão manter lógica atual com `grupo`.

### 3. Telemetria
- `useRegistrarConsultaLoteria`: continua recebendo 1 string em `grupo`. Quando há múltiplos, registrar uma linha por grupo selecionado (loop simples no `handleCalcular`), preservando o agregado de matches por grupo para auditoria correta.

## Não muda
- Cálculo de recomendações (`calcularRecomendacoesPorFaixa`), faixas, fallback de número, lances e modais permanecem iguais — eles operam sobre a lista de `cards` retornada, independente de quantos grupos vieram.
- Layout, design tokens, paginação e demais abas.

## Arquivos afetados
- `src/components/consorcio/ContemplationTab.tsx` (edit)
- `src/hooks/useContemplacao.ts` (edit — adiciona `grupos` ao filtro)
