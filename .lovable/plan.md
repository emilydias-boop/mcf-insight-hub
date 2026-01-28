

# Adicionar Configurações ao Sidebar + Nova Página de Prova Equipe

## Problema 1: Configurações do RH não aparece no sidebar

O menu RH atualmente só tem "Colaboradores". A página `/rh/configuracoes` existe e está roteada, mas não está visível no sidebar.

## Problema 2: Funcionalidade de Prova Equipe

Diego precisa de uma interface para:
1. Criar provas com tema/assunto
2. Buscar colaboradores pelo nome
3. Registrar a nota de cada colaborador
4. Visualizar o histórico de notas (refletir na ficha do colaborador)

---

## Alterações no Sidebar

**Arquivo:** `src/components/layout/AppSidebar.tsx`

Atualizar o item "RH" para incluir subitens:

| Subitem | Rota | Descrição |
|---------|------|-----------|
| Colaboradores | /rh/colaboradores | Lista de colaboradores |
| Prova Equipe | /rh/prova-equipe | Registro de notas de prova |
| Configurações | /rh/configuracoes | Cargos, áreas, squads, departamentos |

---

## Nova Tabela: `employee_exams`

Armazenar as provas/avaliações aplicadas:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador |
| titulo | TEXT | Tema/nome da prova (ex: "Prova Semanal 28/01") |
| descricao | TEXT | Descrição opcional |
| data_aplicacao | DATE | Data em que foi aplicada |
| aplicador_id | UUID | Quem aplicou (user_id) |
| ativo | BOOLEAN | Se a prova está ativa |
| created_at / updated_at | TIMESTAMPTZ | Timestamps |

## Nova Tabela: `employee_exam_scores`

Armazenar as notas individuais:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador |
| exam_id | UUID | FK para employee_exams |
| employee_id | UUID | FK para employees |
| nota | DECIMAL | Nota obtida (0-10 ou %) |
| observacao | TEXT | Comentário opcional |
| created_at / updated_at | TIMESTAMPTZ | Timestamps |

---

## Nova Página: Prova Equipe

**Rota:** `/rh/prova-equipe`

### Interface proposta:

```text
+--------------------------------------------------+
| Prova Equipe                                      |
| Registre notas de provas e avaliações da equipe  |
+--------------------------------------------------+
| [+ Nova Prova]                                   |
+--------------------------------------------------+
| Provas Recentes                                  |
+--------------------------------------------------+
| Data       | Tema              | Participantes  |
| 28/01/2026 | Técnicas de Venda |      12        |
| 21/01/2026 | Produto MCF       |       8        |
+--------------------------------------------------+
```

### Dialog de Nova Prova:
- Campo: Título da prova
- Campo: Data de aplicação (default: hoje)
- Campo: Descrição (opcional)

### Drawer de Registro de Notas:
Ao clicar em uma prova:

```text
+--------------------------------------------------+
| Prova: Técnicas de Venda | 28/01/2026            |
+--------------------------------------------------+
| [Buscar colaborador...]                          |
+--------------------------------------------------+
| Participante        | Nota    | Obs     | Ação  |
| João Silva          |  8.5    |         | [x]   |
| Maria Santos        |  9.0    | Ótimo!  | [x]   |
+--------------------------------------------------+
| [+ Adicionar participante]                       |
+--------------------------------------------------+
```

### Reflexo na Ficha do Colaborador:

Adicionar uma nova aba "Avaliações" no drawer do colaborador mostrando:
- Histórico de provas realizadas
- Notas obtidas
- Média geral

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/rh/ProvaEquipe.tsx` | Página principal de provas |
| `src/components/hr/exams/ExamFormDialog.tsx` | Dialog para criar prova |
| `src/components/hr/exams/ExamScoresDrawer.tsx` | Drawer para registrar notas |
| `src/components/hr/exams/EmployeeSearchCombobox.tsx` | Busca de colaboradores por nome |
| `src/components/hr/tabs/EmployeeExamsTab.tsx` | Aba de avaliações no drawer do colaborador |
| `src/hooks/useExams.ts` | Hooks para CRUD de provas e notas |

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/layout/AppSidebar.tsx` | Adicionar subitens ao menu RH |
| `src/App.tsx` | Adicionar rota /rh/prova-equipe |
| `src/components/hr/EmployeeDrawer.tsx` | Adicionar aba de Avaliações |

---

## Migração SQL

```sql
-- Tabela de provas/avaliações
CREATE TABLE employee_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_aplicacao DATE DEFAULT CURRENT_DATE,
  aplicador_id UUID REFERENCES auth.users(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de notas
CREATE TABLE employee_exam_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES employee_exams(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  nota DECIMAL(5,2) NOT NULL CHECK (nota >= 0 AND nota <= 10),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(exam_id, employee_id)
);

-- RLS
ALTER TABLE employee_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_exam_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read exams" ON employee_exams FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth write exams" ON employee_exams FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Auth read scores" ON employee_exam_scores FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth write scores" ON employee_exam_scores FOR ALL USING (auth.role() = 'authenticated');
```

---

## Fluxo de Uso

1. Diego acessa **RH > Prova Equipe**
2. Clica em **"+ Nova Prova"** e preenche o tema
3. Na lista, clica na prova para abrir o drawer de notas
4. Busca colaboradores pelo nome e registra as notas
5. As notas aparecem na ficha individual de cada colaborador (aba Avaliações)

---

## Detalhes Técnicos

### Hook useExams.ts
- `useExams()` - Lista todas as provas com contagem de participantes
- `useExam(id)` - Detalhes de uma prova específica
- `useExamScores(examId)` - Notas de uma prova
- `useEmployeeExamHistory(employeeId)` - Histórico de provas do colaborador
- Mutations para CRUD completo

### Componente EmployeeSearchCombobox
- Input com autocomplete
- Busca na tabela employees por nome
- Usa Combobox do shadcn/ui (cmdk)
- Filtra colaboradores ativos

### Aba Avaliações no EmployeeDrawer
- Lista de provas realizadas pelo colaborador
- Nota obtida em cada prova
- Média geral calculada
- Data de cada avaliação

