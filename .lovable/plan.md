
# Sistema de Gestão de Entidades do RH

## Visão Geral

Criar uma página de **Configurações do RH** (`/rh/configuracoes`) que permite gerenciar todas as entidades organizacionais:

1. **Cargos / Funções** - Com níveis e valores de remuneração
2. **Departamentos / BUs** - Business Units dinâmicas
3. **Squads / Equipes** - Equipes dentro das BUs

Essas entidades passarão de listas estáticas no código para tabelas dinâmicas no banco de dados, permitindo criar, editar e excluir sem precisar de alterações no código.

---

## Estrutura de Dados (Banco de Dados)

### Tabelas a Criar

| Tabela | Campos Principais |
|--------|-------------------|
| `departamentos` | id, nome, codigo, bu_relacionada, ativo, ordem |
| `squads` | id, nome, departamento_id, ativo, ordem |

A tabela `cargos_catalogo` já existe e será reutilizada.

### Relacionamentos

```text
departamentos (BUs)
    └── squads (Equipes)
    
cargos_catalogo (separado, por área)
    └── employees.cargo_catalogo_id
```

---

## Interface do Usuário

### Nova Página: Configurações do RH

**Rota:** `/rh/configuracoes`

**Abas:**
1. **Cargos** - CRUD completo do catálogo de cargos
2. **Departamentos** - CRUD de BUs/departamentos
3. **Squads** - CRUD de equipes por departamento

---

### Aba 1: Cargos

```text
┌─────────────────────────────────────────────────────────────────┐
│  [+ Novo Cargo]                    [🔍 Buscar...]               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ▼ Inside Sales (12 cargos)                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ SDR Inside N1  │ N1 │ R$ 2.800│ R$ 1.200│ R$ 4.000│ [✏️][🗑]│  │
│  │ SDR Inside N2  │ N2 │ R$ 3.150│ R$ 1.350│ R$ 4.500│ [✏️][🗑]│  │
│  │ Closer Inside  │ N3 │ R$ 3.500│ R$ 2.000│ R$ 5.500│ [✏️][🗑]│  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ▼ Consórcio (4 cargos)                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ SDR Consórcio   │ N1 │ R$ 1.800│ R$ 1.500│ R$ 3.300│ [✏️][🗑]│  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Dialog de Criar/Editar Cargo:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Nome de Exibição | texto | Ex: "SDR Inside N1" |
| Cargo Base | texto | Ex: "SDR" |
| Área | select | Inside Sales, Consórcio, Crédito, etc |
| Nível | número | 1-7 (opcional) |
| Fixo (R$) | moeda | Valor fixo mensal |
| Variável (R$) | moeda | Valor variável potencial |
| OTE Total (R$) | moeda | Auto-calculado: Fixo + Variável |
| Modelo Variável | select | score_metricas, componentes_regua_global |

---

### Aba 2: Departamentos (BUs)

```text
┌─────────────────────────────────────────────────────────────────┐
│  [+ Novo Departamento]                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 🏢 BU - Incorporador 50K   │  4 colaboradores  │ [✏️][🗑]   │  │
│  │ 🏢 BU - Consórcio          │  2 colaboradores  │ [✏️][🗑]   │  │
│  │ 🏢 BU - Crédito            │  3 colaboradores  │ [✏️][🗑]   │  │
│  │ 🏢 Diretoria               │  1 colaborador    │ [✏️][🗑]   │  │
│  │ 🏢 TI                      │  2 colaboradores  │ [✏️][🗑]   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Dialog de Criar/Editar Departamento:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Nome | texto | Ex: "BU - Incorporador 50K" |
| Código | texto | Ex: "incorporador" (para mapeamentos) |
| É BU? | checkbox | Indica se é uma Business Unit válida |

---

### Aba 3: Squads

```text
┌─────────────────────────────────────────────────────────────────┐
│  [+ Nova Squad]              Departamento: [Todos ▼]            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ▼ BU - Incorporador 50K                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 👥 Inside Sales Produto    │  8 colaboradores  │ [✏️][🗑]   │  │
│  │ 👥 Comercial               │  4 colaboradores  │ [✏️][🗑]   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ▼ BU - Consórcio                                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 👥 Vendas Consórcio        │  2 colaboradores  │ [✏️][🗑]   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/rh/Configuracoes.tsx` | Página principal com abas |
| `src/components/hr/config/CargosTab.tsx` | Gestão de cargos |
| `src/components/hr/config/CargoFormDialog.tsx` | Dialog criar/editar cargo |
| `src/components/hr/config/DepartamentosTab.tsx` | Gestão de departamentos |
| `src/components/hr/config/DepartamentoFormDialog.tsx` | Dialog criar/editar depto |
| `src/components/hr/config/SquadsTab.tsx` | Gestão de squads |
| `src/components/hr/config/SquadFormDialog.tsx` | Dialog criar/editar squad |
| `src/hooks/useHRConfig.ts` | Hooks para CRUD das entidades |

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/App.tsx` | Adicionar rota `/rh/configuracoes` |
| `src/components/hr/tabs/EmployeeGeneralTab.tsx` | Usar dados dinâmicos das tabelas |
| `src/components/hr/CargoSelect.tsx` | Já usa `cargos_catalogo`, sem mudança |
| `src/types/hr.ts` | Manter opções estáticas como fallback |
| `src/hooks/useOrganograma.ts` | Adicionar mutations para cargos |

---

## Migrações de Banco de Dados

### Migração 1: Criar tabela departamentos

```sql
CREATE TABLE departamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  codigo TEXT UNIQUE,
  is_bu BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir departamentos existentes
INSERT INTO departamentos (nome, codigo, is_bu) VALUES
  ('BU - Incorporador 50K', 'incorporador', true),
  ('BU - Consórcio', 'consorcio', true),
  ('BU - Crédito', 'credito', true),
  ('Diretoria', 'diretoria', false),
  ('TI', 'ti', false),
  ('Financeiro', 'financeiro', false),
  ('Marketing', 'marketing', false),
  ('RH', 'rh', false);
```

### Migração 2: Criar tabela squads

```sql
CREATE TABLE squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  departamento_id UUID REFERENCES departamentos(id),
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nome, departamento_id)
);

-- Inserir squads existentes
INSERT INTO squads (nome, departamento_id) 
SELECT 'Inside Sales Produto', id FROM departamentos WHERE codigo = 'incorporador';

INSERT INTO squads (nome, departamento_id) 
SELECT 'Comercial', id FROM departamentos WHERE codigo = 'incorporador';
```

---

## Integração com Colaboradores

Depois de criadas as tabelas dinâmicas, o formulário de colaborador (`EmployeeGeneralTab.tsx`) usará:

1. **Cargo**: Já usa `CargoSelect` com dados da `cargos_catalogo`
2. **Departamento**: Passará a buscar de `departamentos` via hook
3. **Squad**: Passará a buscar de `squads` via hook (filtrado por departamento)
4. **Gestor**: Já busca da lista de `employees`

---

## Acesso ao Menu

A nova página será acessível via:
- Link no menu lateral do RH (ícone de engrenagem)
- Rota direta: `/rh/configuracoes`

---

## Resultado Final

| Entidade | Antes | Depois |
|----------|-------|--------|
| Cargos | Tabela `cargos_catalogo` sem UI de gestão | CRUD completo via interface |
| Departamentos | Lista estática em `DEPARTAMENTO_OPTIONS` | Tabela dinâmica `departamentos` |
| Squads | Lista estática em `SQUAD_OPTIONS` | Tabela dinâmica `squads` |

**Benefícios:**
- Autonomia total para criar/editar/excluir entidades
- Consistência de dados entre todos os módulos
- Facilidade para adicionar novas BUs quando necessário
- Valores OTE centralizados e fáceis de atualizar
