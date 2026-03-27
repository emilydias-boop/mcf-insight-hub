

## Evolucao das Configuracoes do RH — Central Estrutural

### Visao geral

Enriquecer a tela de Configuracoes do RH em 3 frentes: (1) expandir o modal de cargo com novos campos, (2) adicionar colunas e badges na listagem de cargos, (3) melhorar as abas de departamentos, squads e areas com mais informacoes e toggle ativo/inativo.

### 1. Migration — Novos campos em `cargos_catalogo`

Adicionar colunas que nao existem hoje:

```sql
ALTER TABLE cargos_catalogo
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS competencias_essenciais TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS competencias_tecnicas TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS documentos_padrao TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trilha_pdi TEXT;
```

Nenhuma tabela nova. Apenas enriquecimento da tabela existente com campos opcionais.

### 2. Modal de cargo expandido (`CargoFormDialog.tsx`)

Converter de `max-w-lg` para `max-w-2xl` e organizar em secoes:

**Secao 1 — Dados basicos** (mantidos):
- Nome exibicao, Cargo base, Area, Nivel, Modelo variavel, Role sistema

**Secao 2 — Descricao** (novo):
- Textarea para descricao do cargo

**Secao 3 — Competencias** (novo):
- Campo de tags/chips para competencias essenciais (input + enter para adicionar)
- Campo de tags/chips para competencias tecnicas

**Secao 4 — Documentos padrao** (novo):
- Campo de tags/chips para tipos de documentos padrao vinculados ao cargo (ex: "Contrato PJ", "Job Description")

**Secao 5 — Desenvolvimento** (novo):
- Campo texto para trilha de PDI sugerida

**Secao 6 — Remuneracao** (mantida):
- Fixo, Variavel, OTE

**Secao 7 — Status** (novo):
- Toggle ativo/inativo visivel no form (hoje so existe no soft delete)

### 3. Listagem de cargos (`CargosTab.tsx`)

Manter a estrutura de tabela agrupada por area. Adicionar:

- Coluna **Status**: badge verde "Ativo" / cinza "Inativo" (mostrar inativos tambem, filtrados por toggle)
- Coluna **Docs**: icone + contagem de `documentos_padrao.length`
- Coluna **Comp.**: icone + contagem de `competencias_essenciais.length + competencias_tecnicas.length`
- Coluna **Role**: badge com `role_sistema`
- Toggle no topo para "Mostrar inativos"
- Remover filtro que esconde inativos (agora controlado pelo toggle)

### 4. Abas Departamentos e Squads — Melhorias

**DepartamentosTab.tsx**:
- Adicionar coluna de cargos vinculados (count de cargos ativos com employees naquele departamento)
- Adicionar badge de status ativo/inativo
- Toggle "Mostrar inativos" no topo
- Mudar delete para soft-delete (set `ativo = false`) em vez de hard delete

**SquadsTab.tsx**:
- Adicionar badge de status ativo/inativo
- Toggle "Mostrar inativos"
- Mudar delete para soft-delete

**AreasTab.tsx** — ja tem cargo_count e status. Sem mudancas.

### 5. Hooks (`useHRConfig.ts`)

- Atualizar interface `Cargo` com novos campos (`descricao`, `competencias_essenciais`, `competencias_tecnicas`, `documentos_padrao`, `trilha_pdi`)
- Remover filtro `.eq('ativo', true)` de `useCargosConfig` (agora retorna todos)
- Atualizar `useDepartamentos` para retornar tambem inativos
- Atualizar `useSquads` para retornar tambem inativos
- Mutation de departamento `remove` passa a ser soft-delete (`ativo = false`)
- Mutation de squad `remove` passa a ser soft-delete (`ativo = false`)

### Arquivos

**Migration**: Adicionar campos em `cargos_catalogo`

**Editados**:
- `src/components/hr/config/CargoFormDialog.tsx` — Modal expandido com descricao, competencias, docs padrao, trilha PDI, toggle ativo
- `src/components/hr/config/CargosTab.tsx` — Novas colunas (status, docs, comp, role), toggle inativos
- `src/components/hr/config/DepartamentosTab.tsx` — Badge status, toggle inativos, soft-delete
- `src/components/hr/config/SquadsTab.tsx` — Badge status, toggle inativos, soft-delete
- `src/hooks/useHRConfig.ts` — Novos campos na interface Cargo, queries sem filtro ativo, soft-delete para dept/squad

### O que NAO muda
- Pagina `Configuracoes.tsx` (layout de abas)
- `AreasTab.tsx` (ja completa)
- Formularios de Departamento, Squad e Area (sem campos novos)
- Nenhuma rota nova

