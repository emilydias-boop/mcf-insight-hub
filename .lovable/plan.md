
## Nova aba "Grupos" em /consorcio

Adicionar uma 4ª aba em `src/pages/bu-consorcio/Index.tsx` chamada **Grupos**, com fluxo lista → detalhe (opção 1 que você escolheu).

### Comportamento

**Lista (estado inicial):**
- Um card por grupo distinto encontrado em `consortium_cards.grupo` (descartando vazios).
- Cada card mostra:
  - Número do grupo
  - Nº de cotas da empresa naquele grupo
  - Valor total de crédito
  - **Saúde do grupo** (badge colorido):
    - Vagas estimadas (média das últimas 5 assembleias registradas, mesmo cálculo do `calcularVagasEstimadas` já existente)
    - Data da última assembleia registrada (ou "Sem histórico")
    - Total de contemplações da empresa no grupo
  - Status do badge: verde se ≥ 1 assembleia nos últimos 30 dias, amarelo se entre 30–90 dias, cinza se sem histórico ou >90 dias.

**Filtros no topo:** busca por número de grupo + ordenação (mais cotas / mais saudável / última assembleia).

**Detalhe (ao clicar no card):**
Drawer lateral (`Sheet`) com:
1. **Cabeçalho:** Grupo + KPIs (cotas, crédito total, vagas estimadas, qtd contemplados da empresa).
2. **Cotas da empresa neste grupo** — tabela compacta (cota, consorciado, valor, status, contemplado?).
3. **Histórico de assembleias** — reaproveita `HistoricoAssembleiaPanel` (já existe). Inclui botão "Registrar Assembleia".
4. **Contemplações registradas** — lista cronológica de todas as contemplações da empresa no grupo (cota + data + motivo + % lance), agregando `consorcio_assembleia_contemplados` cruzado com `consortium_cards.cota`.

### Arquivos

**Novos:**
- `src/components/consorcio/grupos/GruposTab.tsx` — container da aba (lista + estado de drawer aberto).
- `src/components/consorcio/grupos/GrupoCard.tsx` — card de um grupo.
- `src/components/consorcio/grupos/GrupoDetailDrawer.tsx` — Sheet com as 4 seções acima.
- `src/hooks/useGruposSaude.ts` — hook que retorna a lista agregada (`grupo`, `qtd_cotas`, `valor_credito_total`, `ultima_assembleia`, `vagas_estimadas`, `qtd_contemplados_empresa`, `status_saude`).

**Editar:**
- `src/pages/bu-consorcio/Index.tsx` — adicionar `<TabsTrigger value="grupos">Grupos</TabsTrigger>` e o `<TabsContent>` renderizando `<GruposTab />`.

### Dados / queries

Sem migrations — todas as tabelas necessárias já existem:
- `consortium_cards` (grupo, cota, valor_credito, e_contemplada)
- `consorcio_assembleias_historico` (grupo, data_assembleia, qtd_contemplados)
- `consorcio_assembleia_contemplados` (cota, motivo, percentual_lance)
- `consorcio_grupos_config` (vagas_padrao, observacao) — opcional, usado como fallback.

A lista é montada client-side a partir de uma única consulta em `consortium_cards` + uma em `consorcio_assembleias_historico` agrupada por grupo (ordenada por `data_assembleia desc`), e juntada em memória pelo hook.

### Fora de escopo

- Não vou criar gráficos ou predição automática de contemplação por grupo. A "saúde" é baseada apenas no histórico manual.
- Não vou mexer na aba Contemplação — o `HistoricoAssembleiaPanel` continua aparecendo lá também.
