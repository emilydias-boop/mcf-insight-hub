
# Tornar Áreas Editáveis Dinamicamente

## Problema Identificado

1. **Erro ao criar cargo**: A tabela `cargos_catalogo` tem uma CHECK constraint (`cargos_catalogo_area_check`) que restringe o campo `area` a valores fixos
2. **Inconsistência**: O formulário oferece opções como "TI", "RH", "Diretoria" que não estão na constraint
3. **Falta de flexibilidade**: O usuário não consegue adicionar novas áreas sem alterar o banco de dados

### Áreas permitidas atualmente (constraint):
- Inside Sales, Consórcio, Crédito, Marketing, Tecnologia, Financeiro, Projetos, Avulsos

### Áreas no formulário (incorretas):
- Inside Sales, Consórcio, Crédito, Projetos, Outros, Marketing, Financeiro, RH, TI, Diretoria

---

## Solução Proposta

### Fase 1: Criar tabela de áreas dinâmicas

Criar uma tabela `areas_catalogo` para armazenar as áreas e remover a CHECK constraint da tabela `cargos_catalogo`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único |
| nome | TEXT | Nome da área (ex: "Inside Sales") |
| codigo | TEXT | Código interno (ex: "inside_sales") |
| ordem | INTEGER | Ordem de exibição |
| ativo | BOOLEAN | Se a área está ativa |

### Fase 2: Adicionar nova aba "Áreas" na página de Configurações

Nova aba no `/rh/configuracoes` para gerenciar áreas:

```text
[Cargos] [Departamentos/BUs] [Squads] [Áreas]
```

Interface da aba Áreas:
```text
+--------------------------------------------------+
|  [+ Nova Área]                                   |
+--------------------------------------------------+
| Nome              | Código       | Cargos | Ações|
+--------------------------------------------------+
| Inside Sales      | inside_sales |   12   | [✏️][🗑]|
| Consórcio         | consorcio    |    4   | [✏️][🗑]|
| Crédito           | credito      |    3   | [✏️][🗑]|
| Projetos          | projetos     |    2   | [✏️][🗑]|
| Marketing         | marketing    |    1   | [✏️][🗑]|
| Financeiro        | financeiro   |    1   | [✏️][🗑]|
| Tecnologia        | tecnologia   |    0   | [✏️][🗑]|
| RH                | rh           |    0   | [✏️][🗑]|
+--------------------------------------------------+
```

### Fase 3: Atualizar formulário de cargos

O `CargoFormDialog.tsx` passará a buscar as áreas dinamicamente da tabela `areas_catalogo` em vez de usar a lista estática.

---

## Alterações de Banco de Dados

### Migração SQL:

```sql
-- 1. Criar tabela de áreas
CREATE TABLE areas_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  codigo TEXT UNIQUE,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Popular com áreas existentes
INSERT INTO areas_catalogo (nome, codigo, ordem) VALUES
  ('Inside Sales', 'inside_sales', 1),
  ('Consórcio', 'consorcio', 2),
  ('Crédito', 'credito', 3),
  ('Projetos', 'projetos', 4),
  ('Marketing', 'marketing', 5),
  ('Financeiro', 'financeiro', 6),
  ('Tecnologia', 'tecnologia', 7),
  ('RH', 'rh', 8),
  ('Diretoria', 'diretoria', 9),
  ('Avulsos', 'avulsos', 10);

-- 3. Remover CHECK constraint da área
ALTER TABLE cargos_catalogo 
  DROP CONSTRAINT cargos_catalogo_area_check;

-- 4. Adicionar RLS
ALTER TABLE areas_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON areas_catalogo FOR SELECT USING (true);
CREATE POLICY "Auth write" ON areas_catalogo 
  FOR ALL USING (auth.role() = 'authenticated');
```

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/hr/config/AreasTab.tsx` | Aba de gestão de áreas |
| `src/components/hr/config/AreaFormDialog.tsx` | Dialog para criar/editar área |

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/rh/Configuracoes.tsx` | Adicionar aba "Áreas" |
| `src/hooks/useHRConfig.ts` | Adicionar hooks useAreas e useAreaMutations |
| `src/components/hr/config/CargoFormDialog.tsx` | Buscar áreas do banco dinamicamente |

---

## Fluxo de Uso

1. **Admin acessa** `/rh/configuracoes`
2. **Clica na aba** "Áreas"
3. **Clica em "+ Nova Área"** para adicionar uma área
4. A área fica disponível imediatamente no seletor de cargos
5. **Ao criar cargo**, as áreas são carregadas do banco de dados

---

## Resultado Final

| Item | Antes | Depois |
|------|-------|--------|
| Áreas | Lista fixa no código + CHECK constraint | Tabela dinâmica `areas_catalogo` |
| Criar cargo | Erro se área não está na constraint | Funciona com qualquer área cadastrada |
| Adicionar área | Requer alteração de código e banco | Interface visual na página de configurações |
