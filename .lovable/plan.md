

# Reorganizar Filtros da Página Pagamentos Consórcio

## Resumo das mudanças

Simplificar os filtros removendo redundâncias e adicionando filtro por dia de vencimento.

## Mudanças

### 1. Filtros a remover
- **Situação Cota** — redundante com Status
- **Responsável** — não necessário nesta visão
- **Origens** — não necessário nesta visão
- **Período (De/Até)** — sem utilidade clara (já há filtro por mês no topo)
- **Apenas inadimplentes** e **Apenas quitadas** — remover toggles

### 2. Filtros a manter
- **Busca** (texto livre)
- **Status** (Paga, Pendente, Vencendo, Atrasada)
- **Tipo** (Cliente, Empresa)
- **Vencendo esta semana** (toggle)

### 3. Filtro novo: Dia de Vencimento
Dropdown com os dias de vencimento encontrados nos dados (ex: "Dia 5", "Dia 10", "Dia 15", "Dia 20"). Extraído dinamicamente do campo `data_vencimento` (pega o dia do mês). Filtra parcelas cujo vencimento cai naquele dia.

## Arquivos alterados

### `src/hooks/useConsorcioPagamentos.ts`
- Remover do `PagamentosFiltersState`: `situacaoCota`, `grupo`, `responsavel`, `origem`, `periodoInicio`, `periodoFim`, `apenasInadimplentes`, `apenasQuitadas`
- Adicionar: `diaVencimento: string` (default `'todos'`)
- Atualizar `defaultFilters`
- Remover filtros correspondentes do `filteredData`
- Adicionar filtro por dia: extrair dia do `data_vencimento` e comparar
- Atualizar `filterOptions`: remover `responsaveis`/`origens`, adicionar `diasVencimento: number[]`

### `src/components/consorcio/pagamentos/PagamentosFilters.tsx`
- Remover selects de Situação, Grupo, Responsável, Origens, campos de data
- Remover toggles de inadimplentes e quitadas
- Adicionar select de "Dia Vencimento" com opções dinâmicas
- Manter: busca, status, tipo, toggle vencendo esta semana

### `src/components/consorcio/pagamentos/ConsorcioPagamentosTab.tsx`
- Ajustar props de `filterOptions` (remover campos antigos)

