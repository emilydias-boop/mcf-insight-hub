
# Plano: Sistema Hierárquico de Tarefas (Setores > Pastas > Listas)

## Visão Geral

Implementar um sistema de organização hierárquica inspirado no ClickUp dentro da aba **TAREFAS**, com três níveis:

1. **Setores** - Nível superior (ex: "BU - Diretoria")
2. **Pastas** - Dentro dos setores (ex: "Documentos Pessoais")
3. **Listas** - Dentro das pastas OU diretamente dentro dos setores

```text
┌─────────────────────────────────────────────────┐
│  Espaços                       ···  🔍  +       │
├─────────────────────────────────────────────────┤
│  ⚙️  Tudo                                       │
│                                                 │
│  📁 BU - Diretoria               🔒  ···  +     │
│    └─ 📂 Documentos Pessoais     🔒  ···  +     │
│         └─ 📋 List (selecionada)               │
│                                                 │
│  📁 Outro Setor                  🔒  ···  +     │
│    └─ 📋 Lista direta                          │
└─────────────────────────────────────────────────┘
```

---

## Estrutura do Banco de Dados

### Nova Tabela: `task_spaces`

Uma tabela única com auto-referência para suportar a hierarquia flexível:

```sql
CREATE TABLE task_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('setor', 'pasta', 'lista')),
  parent_id UUID REFERENCES task_spaces(id) ON DELETE CASCADE,
  icon TEXT DEFAULT NULL,
  color TEXT DEFAULT NULL,
  order_index INTEGER DEFAULT 0,
  is_private BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_task_spaces_parent ON task_spaces(parent_id);
CREATE INDEX idx_task_spaces_type ON task_spaces(type);

-- RLS
ALTER TABLE task_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view task_spaces"
  ON task_spaces FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can manage task_spaces"
  ON task_spaces FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'coordenador')
    )
  );
```

---

## Arquivos a Criar

### 1. Hook: `src/hooks/useTaskSpaces.ts`

Hook para gerenciar a hierarquia de espaços de tarefas:

- `useTaskSpaces()` - Buscar todos os espaços
- `useCreateTaskSpace()` - Criar setor/pasta/lista
- `useUpdateTaskSpace()` - Atualizar nome, ordem, etc
- `useDeleteTaskSpace()` - Remover (cascade nos filhos)
- `buildTaskSpaceTree()` - Transformar lista flat em árvore

```typescript
// Estrutura do hook
interface TaskSpace {
  id: string;
  name: string;
  type: 'setor' | 'pasta' | 'lista';
  parent_id: string | null;
  icon?: string;
  color?: string;
  order_index: number;
  is_private: boolean;
  children?: TaskSpace[];
}
```

### 2. Componente: `src/components/tasks/TaskSpacesSidebar.tsx`

Sidebar navegável com a hierarquia, similar ao `OriginsSidebar.tsx`:

**Funcionalidades:**
- Header com "Espaços", botão de busca (🔍), e adicionar (+)
- Item "Tudo" para ver todas as tarefas
- Setores colapsáveis com:
  - Ícone personalizado
  - Nome truncado
  - Ícone de cadeado (se privado)
  - Menu de contexto (···)
  - Botão adicionar (+) para criar pasta/lista dentro
- Pastas aninhadas (mesmo padrão)
- Listas com destaque visual quando selecionadas

### 3. Componente: `src/components/tasks/CreateSpaceDialog.tsx`

Modal para criar Setor, Pasta ou Lista:

```typescript
interface CreateSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: string | null;
  parentType?: 'setor' | 'pasta' | null;
  defaultType?: 'setor' | 'pasta' | 'lista';
}
```

**Campos:**
- Nome (obrigatório)
- Tipo (radio: Setor / Pasta / Lista - baseado no contexto)
- Ícone (opcional - selector com lucide icons)
- Cor (opcional - color picker)
- Privado (toggle)

### 4. Componente: `src/components/tasks/SpaceContextMenu.tsx`

Menu de contexto (três pontos) com ações:
- Renomear
- Adicionar pasta/lista (se for setor ou pasta)
- Mover para...
- Duplicar
- Arquivar
- Excluir

### 5. Página Atualizada: `src/pages/Tarefas.tsx`

Layout de duas colunas:

```text
┌──────────────┬─────────────────────────────────┐
│              │                                 │
│   SIDEBAR    │          CONTENT AREA           │
│   (280px)    │                                 │
│              │   (Tarefas da lista/pasta       │
│  - Espaços   │    selecionada ou "Tudo")       │
│  - Setores   │                                 │
│  - Pastas    │                                 │
│  - Listas    │                                 │
│              │                                 │
└──────────────┴─────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/Tarefas.tsx` | Adicionar layout de sidebar + conteúdo |
| `src/integrations/supabase/types.ts` | Regenerado automaticamente após criar tabela |

---

## Fluxo de Navegação

1. Usuário entra em `/tarefas`
2. Sidebar mostra todos os Setores (nível 1)
3. Clicar em um Setor expande suas Pastas e Listas
4. Clicar em uma Pasta expande suas Listas
5. Clicar em uma Lista seleciona e mostra as tarefas no painel principal
6. Botão "+" no header cria novo Setor
7. Botão "+" em um Setor cria Pasta ou Lista dentro dele
8. Botão "+" em uma Pasta cria Lista dentro dela

---

## Detalhes Técnicos

### Ícones por Tipo
```typescript
const typeIcons = {
  setor: Building2,    // ou ícone customizado
  pasta: Folder,
  lista: ListTodo,
};
```

### Estado Local
- `selectedSpaceId` - ID do espaço selecionado
- `expandedSpaces` - Set de IDs expandidos
- `searchTerm` - Filtro de busca

### Cores Padrão
- Setor: bg-green-100 (como na imagem)
- Pasta: bg-amber-100
- Lista: highlight verde quando selecionada

---

## Resumo dos Arquivos

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/hooks/useTaskSpaces.ts` | Criar | Hook de CRUD para hierarquia |
| `src/components/tasks/TaskSpacesSidebar.tsx` | Criar | Sidebar de navegação |
| `src/components/tasks/CreateSpaceDialog.tsx` | Criar | Modal de criação |
| `src/components/tasks/SpaceContextMenu.tsx` | Criar | Menu de contexto |
| `src/pages/Tarefas.tsx` | Modificar | Layout com sidebar |
| Tabela `task_spaces` | SQL | Nova tabela no Supabase |

---

## Próximos Passos Após Aprovação

1. Criar a tabela `task_spaces` no Supabase
2. Implementar o hook `useTaskSpaces`
3. Criar os componentes de UI
4. Atualizar a página Tarefas com o layout
5. Adicionar as funcionalidades de drag-and-drop para reordenação (futuro)
