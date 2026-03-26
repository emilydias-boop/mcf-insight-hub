

## Evolucao do Drawer — Perfil Unico do Colaborador

### Visao geral

Transformar o drawer de 8 abas em um perfil 360 com 10 abas. As 8 abas existentes serao mantidas e enriquecidas, e 2 novas abas serao criadas: **Gestao de Tempo** e **Compliance**.

### Mudancas por aba

**1. Geral** — Ja completa. Sem mudancas.

**2. Remuneracao** — Ja inclui fixo/variavel/OTE/bancario/NFSe. Adicionar:
- Subsecao "Historico de Alteracoes" mostrando events do tipo `ajuste_salarial`, `promocao` filtrados de `employee_events`
- Cards visuais de resumo (Fixo atual, OTE, Nivel)

**3. NFSe** — Ja completa. Sem mudancas estruturais.

**4. Documentos** — Ja tem upload/download/CRUD. Adicionar:
- Categorias visuais agrupadas: "Contrato", "Job Description", "Plano de Carreira", "Pessoais", "Outros"
- Filtro por categoria no topo

**5. Historico e Desempenho** (renomear de "Hist.") — Ja tem timeline de events. Adicionar:
- Subsecao "Avaliacoes de Desempenho" (puxar do `employee_exams` existente)
- Campo de observacoes
- Botao exportar Excel/PDF da timeline

**6. Gestao de Tempo** (NOVA) — Nova tabela `employee_time_records`:
```sql
CREATE TABLE employee_time_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ferias','ausencia_justificada','ausencia_injustificada','atestado','licenca')),
  data_inicio DATE NOT NULL,
  data_fim DATE,
  dias INT,
  motivo TEXT,
  anexo_path TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE employee_time_records ENABLE ROW LEVEL SECURITY;
```
- UI: Cards de saldo (ferias tiradas/restantes, ausencias, atestados)
- Tabela com CRUD de registros
- Filtro por tipo e periodo

**7. Compliance** (NOVA, acesso RH/CEO) — Nova tabela `employee_compliance`:
```sql
CREATE TABLE employee_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('advertencia','descumprimento_politica','investigacao','flag_risco')),
  severidade TEXT NOT NULL CHECK (severidade IN ('leve','media','grave')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_ocorrencia DATE NOT NULL,
  anexo_path TEXT,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','encerrado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE employee_compliance ENABLE ROW LEVEL SECURITY;
```
- UI: Cards resumo (total abertos, por severidade)
- Timeline com CRUD, badge de severidade, status
- Upload de evidencias
- Visibilidade restrita: aba so aparece para roles admin/rh/manager

**8. Notas** — Ja completa com CRUD e categorias. Sem mudancas.

**9. Permissoes** — Ja completa com vinculo, roles, permissoes por modulo, integracoes. Sem mudancas.

**10. Avaliacoes / PDI** (expandir) — Ja tem historico de provas. Adicionar:
- Subsecao PDI: listar `employee_pdi` do colaborador com progresso
- Subsecao Competencias (placeholder inicial com texto)

### Arquivos

**Novas tabelas (migration):**
- `employee_time_records`
- `employee_compliance`
Com RLS: authenticated pode ler/inserir onde employee_id pertence ao contexto (admin/rh full access).

**Novos componentes:**
- `src/components/hr/tabs/EmployeeTimeTab.tsx` — Gestao de Tempo com CRUD
- `src/components/hr/tabs/EmployeeComplianceTab.tsx` — Compliance com CRUD

**Editados:**
- `src/components/hr/EmployeeDrawer.tsx` — Adicionar 2 abas novas (Tempo + Compliance), renomear "Hist." para "Desemp.", compliance condicional por role
- `src/components/hr/tabs/EmployeeRemunerationTab.tsx` — Adicionar subsecao historico de alteracoes salariais
- `src/components/hr/tabs/EmployeeDocumentsTab.tsx` — Adicionar filtro por categoria
- `src/components/hr/tabs/EmployeeHistoryTab.tsx` — Adicionar botao exportar e subsecao feedbacks
- `src/components/hr/tabs/EmployeeExamsTab.tsx` — Adicionar subsecao PDI do colaborador
- `src/hooks/useEmployees.ts` — Adicionar hooks para time_records e compliance

### O que NAO muda
- Layout do drawer (Sheet side panel)
- Header com avatar/nome/status/cargo/datas
- Abas Geral, NFSe, Notas, Permissoes (conteudo existente intacto)
- Nenhuma tabela existente e alterada

