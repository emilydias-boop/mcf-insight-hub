
# Documentos Estrategicos por BU

## Resumo
Criar um modulo de upload e visualizacao de documentos estrategicos (PDFs) por Business Unit, com controle rigido de permissoes por cargo. Cada BU tera uma aba "Documentos Estrategicos" visivel apenas para coordenadores e acima. Diretores/admins podem ver documentos de todas as BUs.

## Estrutura

### 1. Banco de Dados

**Nova tabela: `bu_strategic_documents`**
- `id` (uuid, PK)
- `bu` (text, NOT NULL) - identificador da BU (incorporador, consorcio, credito, projetos, leilao)
- `mes` (integer, NOT NULL) - mes de referencia (1-12)
- `ano` (integer, NOT NULL) - ano de referencia
- `semana` (integer, NOT NULL) - semana dentro do mes (1-5)
- `nome_arquivo` (text, NOT NULL)
- `storage_path` (text, NOT NULL)
- `uploaded_by` (uuid, FK profiles.id)
- `uploaded_by_name` (text) - nome de quem enviou (desnormalizado para exibicao rapida)
- `uploaded_by_role` (text) - cargo de quem enviou
- `created_at` (timestamptz, default now())

RLS: Apenas usuarios autenticados com role coordenador, manager ou admin podem SELECT/INSERT/DELETE. Admins e managers podem ver de todas as BUs; coordenadores apenas da sua squad/BU.

**Novo bucket de storage: `bu-strategic-documents`**
- Bucket privado
- Politicas de acesso para authenticated users (upload, view, delete)
- Path: `{bu}/{ano}/{mes}/semana-{semana}/{filename}`

### 2. Hook: `useBUStrategicDocuments`
- Busca documentos filtrados por BU, mes, ano e semana
- Mutations para upload (com validacao PDF only) e delete
- No upload: salva no storage, cria registro com mes/semana, busca nome e cargo do usuario logado

### 3. Pagina: `BUDocumentosEstrategicos.tsx`
Componente reutilizavel que recebe `bu` como prop:
- **Filtros no topo**: Ano, Mes, Semana (dropdowns)
- **Botao de upload**: abre dialog para selecionar PDF, informar Mes e Semana
- **Lista de documentos**: agrupados por Semana, exibindo nome do arquivo, quem enviou, cargo, data
- **Clique no documento**: abre o PDF (signed URL)
- **Delete**: icone de lixeira para quem tem permissao

### 4. Rotas (App.tsx)
Uma rota por BU, todas protegidas com RoleGuard:
- `/bu-incorporador/documentos-estrategicos`
- `/consorcio/documentos-estrategicos`
- `/bu-credito/documentos-estrategicos`
- `/bu-projetos/documentos-estrategicos`
- `/leilao/documentos-estrategicos`

Cada rota passa a `bu` correspondente como prop.

### 5. Sidebar (AppSidebar.tsx)
Adicionar "Documentos Estrategicos" como subitem em cada BU:
- BU Incorporador MCF -> Documentos Estrategicos
- BU Consorcio -> Documentos Estrategicos
- BU Credito -> Documentos Estrategicos
- BU Projetos -> Documentos Estrategicos
- Leilao -> Documentos Estrategicos

Visivel apenas para `admin`, `manager`, `coordenador` (via `requiredRoles`).

### 6. Permissoes
- **Coordenadores**: veem e uploadam documentos da sua BU
- **Managers/Admins**: veem e uploadam documentos de TODAS as BUs, com um seletor de BU no topo da pagina para alternar entre elas
- **Demais cargos**: nao veem a aba nem tem acesso

## Detalhes Tecnicos

### Migracao SQL
```text
- CREATE TABLE bu_strategic_documents (campos acima)
- ALTER TABLE ... ENABLE ROW LEVEL SECURITY
- CREATE POLICY para SELECT/INSERT/DELETE restrito a coordenador+
- INSERT INTO storage.buckets (bu-strategic-documents, privado)
- CREATE POLICY storage para authenticated users
```

### Componente de Upload
- Input file com `accept=".pdf"`
- Selects para Mes (Janeiro-Dezembro) e Semana (1 a 5)
- Validacao: arquivo obrigatorio, max 20MB, apenas PDF
- Ao salvar: upload no storage -> criar registro na tabela com nome/cargo do uploader

### Componente de Listagem
- Agrupado por semana (Semana 1, Semana 2, etc.)
- Cada item mostra: icone PDF, nome do arquivo, "Enviado por [Nome] ([Cargo])", data formatada
- Botao de download/visualizar (signed URL)
- Botao de deletar (apenas para quem fez upload ou admin)

### Arquivos novos
- `supabase/migrations/xxx_bu_strategic_documents.sql` - tabela + bucket + RLS
- `src/hooks/useBUStrategicDocuments.ts` - hook de dados
- `src/pages/bu-common/DocumentosEstrategicos.tsx` - pagina reutilizavel
- Alteracoes em `src/App.tsx` (5 rotas) e `src/components/layout/AppSidebar.tsx` (5 subitens)
