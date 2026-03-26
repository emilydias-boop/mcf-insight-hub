

## Fase 3: PDI — Plano de Desenvolvimento Individual

### Visão geral

Implementar a aba "PDI" como uma trilha de desenvolvimento do colaborador, com metas/competências, etapas de progresso e comentários do gestor/RH.

### Nova tabela: `employee_pdi`

```sql
CREATE TABLE employee_pdi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'competencia' 
    CHECK (categoria IN ('competencia', 'tecnico', 'comportamental', 'lideranca', 'outro')),
  status TEXT NOT NULL DEFAULT 'nao_iniciado' 
    CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido', 'cancelado')),
  prioridade TEXT NOT NULL DEFAULT 'media' 
    CHECK (prioridade IN ('baixa', 'media', 'alta')),
  data_inicio DATE,
  data_prevista DATE,
  data_conclusao DATE,
  progresso INTEGER NOT NULL DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE employee_pdi_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id UUID NOT NULL REFERENCES employee_pdi(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  autor_nome TEXT,
  autor_tipo TEXT NOT NULL DEFAULT 'rh' CHECK (autor_tipo IN ('colaborador', 'gestor', 'rh')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
```

RLS: colaborador vê apenas seus PDIs (via employee_id -> employees.user_id = auth.uid()). Comentários acessíveis via join com PDI.

### Arquivos novos

**`src/hooks/useEmployeePdi.ts`** — Hooks React Query:
- `useMyPdis(employeeId)` — lista PDIs do colaborador
- `useMyPdiComments(pdiId)` — lista comentários de um PDI
- `useAddPdiComment()` — mutation para colaborador adicionar comentário

**`src/components/meu-rh/MeuRHPdiSection.tsx`** — Componente principal da aba:
- Resumo no topo: total de PDIs, em andamento, concluídos, barra de progresso geral
- Lista de cards por PDI mostrando: título, categoria badge, status badge, progresso (barra), datas
- Cada card expansível com descrição completa e seção de comentários
- Empty state com mensagem motivacional

### Layout da aba

```text
┌──────────────────────────────────────────────────────┐
│ Meu PDI                                              │
├──────────────────────────────────────────────────────┤
│ [3 Metas] [1 Em andamento] [2 Concluídas] [■■■ 67%] │
├──────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐ │
│ │ 🟡 Em andamento · Técnico · Alta                 │ │
│ │ "Certificação em análise de crédito"             │ │
│ │ Progresso: ████████░░ 80%                        │ │
│ │ Prazo: 30/06/2026                                │ │
│ │ ▼ Ver detalhes e comentários                     │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 🟢 Concluído · Comportamental                   │ │
│ │ "Desenvolver comunicação assertiva"              │ │
│ │ Progresso: ██████████ 100%                       │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Arquivos editados

**`src/pages/MeuRH.tsx`**: Substituir PlaceholderTab de "pdi" pelo componente `MeuRHPdiSection`

**`src/types/hr.ts`**: Adicionar interfaces `EmployeePdi` e `EmployeePdiComment` + constantes de labels/cores

### O que NAO muda
- Todas as abas existentes (Perfil, Documentos, Fale com RH, Avaliações, Histórico)
- Quick Cards e Quick Actions
- Abas Políticas e Comunicados continuam placeholder

