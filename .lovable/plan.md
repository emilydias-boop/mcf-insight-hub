

## Evolucao da Tela Prova Equipe — Modulo de Avaliacao e Desenvolvimento

### Visao geral

Transformar a tela simples de listagem em um modulo completo de avaliacao com dashboard gerencial, tela de detalhe por prova (pagina dedicada), metricas por cargo/squad, ranking e integracao com PDI. Nenhuma tabela nova necessaria — tudo sera derivado das tabelas `employee_exams`, `employee_exam_scores`, `employees` e `employee_pdi` existentes.

### 1. Cards gerenciais expandidos (7 cards, grid responsivo)

Manter os 3 atuais e adicionar 4:
- **Media Geral**: media de todas as notas de todas as provas
- **Maior Nota**: nota maxima global
- **Menor Nota**: nota minima global
- **Taxa de Participacao**: total de scores / (total de provas x total de employees ativos) em %

Dados calculados client-side a partir dos scores ja carregados no hook `useExams` (adicionar um hook `useAllExamScores` que busca todos os scores de provas ativas para as metricas globais).

### 2. Lista de provas melhorada

Cada item da lista passa a exibir:
- Titulo + descricao
- Data de aplicacao
- Participantes (badge)
- **Media da prova** (badge colorido >=7 verde, >=5 amarelo, <5 vermelho)
- **Status**: "Em andamento" se participantes < headcount, "Finalizada" caso contrario (badge)
- Botao de acoes (dropdown: ver detalhe, excluir)

O hook `useExams` sera enriquecido para retornar tambem a `media` de cada prova (buscar scores junto com contagem).

### 3. Tela de detalhe da prova (pagina dedicada)

Converter o drawer `ExamScoresDrawer` em uma pagina `/rh/prova-equipe/:id` com:

**Header**: titulo, data, descricao, media geral, participantes, botao voltar, botao exportar XLSX

**Secao "Participantes"**: tabela completa com:
- Nome, Cargo, Squad do employee
- Nota (badge colorido)
- Observacao
- Data de avaliacao
- Acoes (editar nota, remover)
- Botao "Adicionar Participante" (form inline ou dialog)

**Secao "Metricas"**:
- Media por cargo (agrupamento dos scores por `employee.cargo`)
- Media por squad (agrupamento por `employee.squad`)
- Ranking (lista ordenada por nota desc, com posicao)

**Exportacao**: botao que gera XLSX com todos os dados da prova (usando `xlsx`)

### 4. Integracao com PDI

Na tela de detalhe, adicionar secao "Vincular ao PDI":
- Para cada participante com nota < 7, exibir sugestao de vinculacao
- Botao "Criar PDI" que abre dialog pre-preenchido com titulo da prova como competencia
- Isso cria um registro em `employee_pdi` vinculado

### Arquivos

**Nova rota em `src/App.tsx`**: `/rh/prova-equipe/:id` apontando para `ExamDetail`

**Novo: `src/pages/rh/ExamDetail.tsx`**
- Pagina de detalhe da prova com header, tabela de participantes, metricas por cargo/squad, ranking, exportacao XLSX, integracao PDI

**Novo: `src/components/hr/exams/ExamStatsCards.tsx`**
- 7 cards gerenciais com metricas globais

**Novo: `src/components/hr/exams/ExamMetrics.tsx`**
- Componente de metricas da prova (media por cargo, por squad, ranking)

**Editado: `src/pages/rh/ProvaEquipe.tsx`**
- Substituir cards por `ExamStatsCards`
- Lista de provas com media, status e navegacao para `/rh/prova-equipe/:id`
- Remover drawer, usar navegacao por rota

**Editado: `src/hooks/useExams.ts`**
- Enriquecer `useExams` para retornar media por prova
- Novo hook `useAllExamStats` para metricas globais (todas as notas)
- Enriquecer `useExamScores` para incluir `squad` do employee

**Editado: `src/components/hr/exams/ExamFormDialog.tsx`** — sem mudancas

### O que NAO muda
- Tabelas do banco (nenhuma migration)
- `ExamFormDialog` (criacao de prova)
- Hooks de mutations (create/update/delete score)
- Integracao existente no perfil do colaborador (aba Avaliacoes/PDI)

