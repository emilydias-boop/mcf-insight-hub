

## Evolucao da Tela de Colaboradores — Central Administrativa de Gestao de Pessoas

### Visao geral

Transformar a listagem atual em uma central gerencial com cards expandidos, filtros robustos, acoes rapidas, ordenacao de tabela e exportacao XLSX.

### 1. Cards gerenciais expandidos (8 cards, grid 2x4)

Manter os 4 atuais (Total, Ativos, Em Experiencia, NFSe Pendente) e adicionar:
- **Turnover**: desligados nos ultimos 30 dias / headcount ativo (%)
- **Pendencias RH**: count de `rh_tickets` com status != `finalizado`
- **Red Flags**: count de `user_flags` com `is_resolved = false` (via query direta)
- **Chamados Abertos**: count de `rh_tickets` com status `aberto` ou `em_andamento`

Queries adicionais no proprio componente via `useQuery` direto no Supabase (sem tabelas novas).

### 2. Filtros robustos

Substituir a barra de filtros atual por uma linha mais completa:
- **Busca** (nome, cargo, squad — ja existe)
- **Status** (ativo, ferias, afastado, desligado — ja existe)
- **Cargo** (ja existe, manter dinamico)
- **Squad** (ja existe)
- **Tipo de contrato**: PJ / CLT / Estagio (novo select, valores dinamicos)
- **Gestor**: select com gestores unicos extraidos dos employees (novo)
- **Area/Departamento**: select dinamico (novo)

Adicionar botao "Limpar filtros" quando houver filtro ativo e contador de resultados.

### 3. Acoes rapidas no topo

Substituir o botao unico "Novo Colaborador" por uma toolbar com:
- **Novo Colaborador** (mantido, botao primario)
- **Exportar Base** (gera XLSX com dados filtrados usando `xlsx` lib)
- **Ver Organograma** (link para `/rh/configuracoes` aba organograma, ou modal futuro)
- **Pendencias RH** (scroll/filter para tickets abertos)
- **Chamados Abertos** (abre filtro rapido)

### 4. Tabela melhorada

- **Ordenacao por colunas**: estado local `sortField` + `sortDirection`, clicar no header alterna ASC/DESC com icone visual
- **Coluna "Admissao"**: nova coluna com `data_admissao` formatada
- **Coluna "Tipo"**: tipo de contrato (PJ/CLT)
- **Acoes por linha**: dropdown menu (tres pontos) com "Abrir ficha", "Editar", "Excluir" em vez de so icone de lixeira
- **Contador de resultados**: "Mostrando X de Y colaboradores"

### 5. Contexto por perfil (visibilidade)

Usar `useAuth()` + roles do JWT para filtrar:
- **admin, rh, manager**: veem todos
- **coordenador, gestor**: veem apenas employees onde `gestor_id` = seu employee id
- **demais**: redirect ou acesso negado (ja controlado pelo RoleGuard existente)

Isso sera uma filtragem client-side sobre os dados retornados, usando o `user_id` autenticado para encontrar o employee correspondente e filtrar por `gestor_id`.

### Arquivos

**Editado: `src/pages/rh/Colaboradores.tsx`** — Refactor completo:
- Stats cards expandidos (8 cards)
- Toolbar de acoes rapidas
- Filtros expandidos com tipo contrato, gestor, departamento
- Tabela com sort, colunas extras, dropdown de acoes
- Contador de resultados
- Filtro por perfil/role

**Novo: `src/components/hr/ColaboradoresStatsCards.tsx`** — Componente dos 8 cards gerenciais (queries de tickets e flags)

**Novo: `src/components/hr/ColaboradoresToolbar.tsx`** — Toolbar de acoes rapidas

**Novo: `src/components/hr/ColaboradoresFilters.tsx`** — Barra de filtros expandida

**Novo: `src/components/hr/ColaboradoresTable.tsx`** — Tabela com sort, dropdown de acoes, colunas extras

**Novo: `src/lib/exportEmployees.ts`** — Funcao de exportacao XLSX da lista filtrada

### O que NAO muda
- `EmployeeDrawer` e `EmployeeFormDialog` mantidos intactos
- Nenhuma tabela nova no banco (usa queries existentes em `rh_tickets`, `user_flags`)
- Logica de NFSe no mes atual mantida
- Delete confirmation dialog mantido

