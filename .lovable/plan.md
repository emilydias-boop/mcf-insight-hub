

## Adicionar Filtros Completos + Exportação Excel/PDF ao Controle Diego

### Problema
O painel Controle Diego possui apenas 3 filtros (Período, Buscar, Closer) mas o usuário precisa dos mesmos filtros do relatório de Contratos: **Fonte**, **Pipeline** e **Canal**, além de opções de exportação em **Excel** e **PDF**.

### Alterações

#### 1. `src/components/relatorios/ControleDiegoPanel.tsx`
- Adicionar estados para `selectedSource` (Fonte: Ambos/Agenda/Hubla/Pendentes), `selectedOriginId` (Pipeline), `selectedChannel` (Canal: Todos/A010/BIO/LIVE)
- Importar `useHublaA000Contracts` para suportar filtro de Fonte (mesma lógica do `ContractReportPanel`)
- Importar `useQuery` + `supabase` para buscar origens (pipelines) para o select
- Adicionar os 3 novos Selects na barra de filtros
- Aplicar filtros no `useMemo` de `rows`:
  - **Fonte**: combinar agenda + hubla (como no ContractReportPanel)
  - **Pipeline**: filtrar por `originName` 
  - **Canal**: filtrar por `salesChannel`
- Adicionar botão **Exportar Excel** que gera XLSX com todas as colunas relevantes (Nome, Closer, SDR, Pipeline, Canal, Data R1, Data Pgto, Telefone, Email, Status Vídeo)
- Adicionar botão **Exportar PDF** que gera um relatório limpo e explicativo

#### 2. Exportação Excel
- Usar `xlsx` (já instalado) para gerar planilha com dados filtrados
- Colunas: Nome do Lead, Closer, SDR, Pipeline/Origem, Canal, Data R1, Data Pagamento, Telefone, Email, Status do Vídeo (Enviado/Pendente), Data Envio

#### 3. Exportação PDF
- Usar abordagem de gerar HTML formatado e abrir `window.print()` com layout limpo, ou gerar PDF client-side
- Incluir cabeçalho com período e filtros ativos, tabela com dados, totais/KPIs

### Filtros adicionados (layout)
```text
Período | Buscar | Fonte | Closer | Pipeline | Canal | [Exportar Excel] [Exportar PDF]
```

### Arquivos modificados
- `src/components/relatorios/ControleDiegoPanel.tsx` — filtros, lógica de filtragem, exportação

