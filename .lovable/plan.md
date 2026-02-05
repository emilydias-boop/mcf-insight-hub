
# Central de Controle de Patrimônio (TI)

## Visao Geral

Modulo completo para gestao de equipamentos de TI com cadastro, historico versionado, vinculos com colaboradores, checklist de itens, termo de responsabilidade com aceite digital e relatorios.

---

## 1. Estrutura de Banco de Dados

### Tabela: `assets` (Equipamentos)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| numero_patrimonio | text UNIQUE | Numero interno |
| tipo | enum | notebook, desktop, monitor, celular, tablet, impressora, outro |
| marca | text | Fabricante |
| modelo | text | Modelo |
| numero_serie | text | Serial number |
| sistema_operacional | text | Windows, macOS, Linux, iOS, Android |
| data_compra | date | Data de aquisicao |
| fornecedor | text | Nome do fornecedor |
| nota_fiscal_url | text | URL do arquivo no storage |
| nota_fiscal_path | text | Path no bucket |
| status | enum | em_estoque, em_uso, em_manutencao, devolvido, baixado |
| observacoes | text | Notas gerais |
| created_at, updated_at, created_by | timestamps + audit |

### Tabela: `asset_assignments` (Vinculos com Colaborador)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| asset_id | uuid FK | Equipamento |
| employee_id | uuid FK | Colaborador |
| setor | text | Departamento |
| cargo | text | Cargo na liberacao |
| data_liberacao | date | Inicio do uso |
| data_prevista_devolucao | date | Opcional |
| data_devolucao_real | date | Preenchido na devolucao |
| status | enum | ativo, devolvido, transferido |
| termo_id | uuid FK | Termo gerado |
| created_at, created_by | audit |

### Tabela: `asset_assignment_items` (Itens Entregues)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| assignment_id | uuid FK | Vinculo |
| item_tipo | text | mouse, carregador, headset, teclado, mochila, outro |
| descricao | text | Descricao para "outro" |
| conferido_devolucao | boolean | Checado na devolucao |
| observacao_devolucao | text | Nota da devolucao |

### Tabela: `asset_terms` (Termos de Responsabilidade)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| assignment_id | uuid FK | Vinculo |
| asset_id | uuid FK | Equipamento |
| employee_id | uuid FK | Colaborador |
| termo_conteudo | text | HTML/Markdown do termo gerado |
| aceito | boolean | Indica aceite |
| data_aceite | timestamp | Momento do aceite |
| ip_aceite | text | IP do aceite (opcional) |
| assinatura_digital | text | Base64 da assinatura (canvas) |
| bloqueado | boolean DEFAULT true | Impede edicao apos aceite |
| storage_path | text | PDF gerado salvo no bucket |
| created_at | timestamp |

### Tabela: `asset_history` (Historico Versionado)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| asset_id | uuid FK | Equipamento |
| tipo_evento | enum | comprado, liberado, transferido, manutencao, devolucao, baixa |
| descricao | text | Detalhes do evento |
| dados_anteriores | jsonb | Snapshot antes |
| dados_novos | jsonb | Snapshot depois |
| created_at | timestamp |
| created_by | uuid | Usuario que registrou |

---

## 2. Estrutura de Arquivos

```text
src/
  pages/
    patrimonio/
      Index.tsx           # Lista de equipamentos (tabela/grid)
      Equipamento.tsx     # Detalhe do equipamento (drawer/page)
      Liberacao.tsx       # Fluxo de liberacao
      Termos.tsx          # Lista de termos gerados
      Relatorios.tsx      # Visoes e filtros

  components/
    patrimonio/
      AssetFormDialog.tsx       # Cadastro/Edicao
      AssetDrawer.tsx           # Detalhe lateral
      AssetCard.tsx             # Card resumo
      AssetStatusBadge.tsx      # Badge colorido
      AssetHistoryTimeline.tsx  # Timeline de eventos
      AssignmentDialog.tsx      # Liberacao
      ChecklistItems.tsx        # Checklist de itens
      TermoPreview.tsx          # Preview do termo
      TermoAceiteDialog.tsx     # Modal de aceite (assinatura)
      DevolutivaDialog.tsx      # Conferencia na devolucao
      AssetFilters.tsx          # Filtros avancados
      AssetStats.tsx            # Cards de metricas

  hooks/
    useAssets.ts              # CRUD equipamentos
    useAssetAssignments.ts    # Vinculos
    useAssetTerms.ts          # Termos
    useAssetHistory.ts        # Historico

  types/
    patrimonio.ts             # Interfaces TypeScript
```

---

## 3. Fluxos Principais

### 3.1 Cadastro de Equipamento

1. Admin/TI acessa Central de Patrimonio
2. Clica em "Novo Equipamento"
3. Preenche formulario (numero patrimonio, tipo, marca, modelo, serie, SO, data compra, fornecedor)
4. Upload de nota fiscal (opcional)
5. Status inicial: "Em Estoque"
6. Evento registrado: "comprado"

### 3.2 Liberacao para Colaborador

1. Seleciona equipamento em estoque
2. Abre modal de liberacao
3. Seleciona colaborador (autocomplete da tabela employees)
4. Setor e cargo preenchidos automaticamente
5. Define data de liberacao e devolucao prevista (opcional)
6. Marca itens entregues no checklist (mouse, carregador, headset, teclado, mochila, outros)
7. Sistema gera termo de responsabilidade
8. Exibe preview do termo
9. Colaborador visualiza e clica "Aceitar"
10. Captura assinatura digital (canvas ou checkbox "Li e aceito")
11. Termo travado - nao editavel
12. Status equipamento: "Em Uso"
13. Evento registrado: "liberado"

### 3.3 Transferencia entre Colaboradores

1. Seleciona equipamento em uso
2. Abre opcao "Transferir"
3. Assignment atual finalizado (status = transferido)
4. Novo assignment criado com novo colaborador
5. Novo termo gerado e aceito
6. Historico mantido - nunca sobrescrito
7. Evento registrado: "transferido"

### 3.4 Devolucao

1. Seleciona equipamento em uso
2. Abre modal de devolucao
3. Confere itens entregues (checklist com marcacao)
4. Registra observacoes de cada item
5. Assignment finalizado
6. Status equipamento: "Devolvido" ou "Em Estoque"
7. Evento registrado: "devolucao"

### 3.5 Manutencao / Baixa

1. Altera status do equipamento
2. Registra evento correspondente
3. Historico atualizado

---

## 4. Visao do Colaborador

Colaborador comum (nao TI/Admin) acessa "Meu RH" e ve:

- Aba "Meus Equipamentos": equipamentos atualmente vinculados
- Aba "Meus Termos": lista de termos assinados
- Download do termo em PDF

Sem permissao para cadastrar, liberar ou editar equipamentos.

---

## 5. Permissoes

### Nova Resource Type: `patrimonio`

Adicionar ao enum `resource_type`:
- `patrimonio`

### Niveis de Acesso

| Role | Acesso |
|------|--------|
| admin | Full - cadastrar, liberar, transferir, gerar termos, ver todos |
| manager | Edit - mesmas permissoes do admin |
| rh | View - apenas visualizar |
| ti (novo role opcional) | Full - dedicado ao TI |
| sdr, closer, viewer | None - apenas seus proprios equipamentos via Meu RH |

---

## 6. Relatorios e Visoes

Cards de estatisticas no topo:
- Total de equipamentos
- Em estoque
- Em uso
- Em manutencao
- Baixados

Filtros:
- Por tipo (notebook, desktop, etc)
- Por status
- Por setor/departamento
- Por colaborador
- Por periodo de compra

Tabela exportavel para Excel.

---

## 7. Rotas

```text
/patrimonio              # Lista de equipamentos
/patrimonio/novo         # Formulario de cadastro
/patrimonio/:id          # Detalhe do equipamento
/patrimonio/termos       # Lista de termos
/patrimonio/relatorios   # Visoes e metricas
```

Rotas protegidas com `ResourceGuard` resource="patrimonio".

---

## 8. Integracao com Sistema Existente

### Colaboradores
Usa tabela `employees` existente para vincular equipamentos.

### Arquivos
Usa bucket `user-files` ou novo bucket `patrimonio-files` para:
- Notas fiscais
- Termos assinados (PDF)

### Historico
Segue padrao de `employee_events` - apenas inserts, nunca updates.

### Menu Principal
Adicionar link "Patrimonio" no sidebar para usuarios com permissao.

---

## 9. Detalhes Tecnicos

### Migrations
1. Criar enums: `asset_type`, `asset_status`, `asset_event_type`, `assignment_status`
2. Criar tabelas: `assets`, `asset_assignments`, `asset_assignment_items`, `asset_terms`, `asset_history`
3. Adicionar `patrimonio` ao enum `resource_type`
4. Inserir permissao padrao na `role_permissions`
5. Politicas RLS:
   - Admin/Manager: acesso total
   - Colaborador: apenas seus proprios registros (via employee_id + user_id)

### Hooks (React Query)
- `useAssets()` - lista todos
- `useAsset(id)` - detalhe
- `useAssetAssignments(assetId)` - vinculos do equipamento
- `useAssetHistory(assetId)` - timeline
- `useAssetTerms(employeeId)` - termos do colaborador
- `useAssetMutations()` - create, update, assign, transfer, return

### Componentes Principais
- `AssetFormDialog` - formulario completo com upload
- `AssignmentDialog` - wizard de liberacao com checklist e preview do termo
- `TermoAceiteDialog` - modal com assinatura digital (canvas)
- `DevolutivaDialog` - conferencia de itens
- `AssetHistoryTimeline` - timeline visual de eventos

---

## 10. Fases de Implementacao

### Fase 1: Database
- Migrations com tabelas e enums
- RLS policies
- Bucket storage (se necessario)

### Fase 2: Backend/Hooks
- Types TypeScript
- Hooks de CRUD
- Logica de eventos

### Fase 3: UI Core
- Pagina de listagem
- Formulario de cadastro
- Drawer de detalhes

### Fase 4: Liberacao
- Fluxo de assignment
- Checklist de itens
- Geracao do termo

### Fase 5: Aceite Digital
- Preview do termo
- Assinatura (canvas ou checkbox)
- Travamento apos aceite

### Fase 6: Devolucao/Transferencia
- Modal de devolucao com conferencia
- Fluxo de transferencia
- Manutencao e baixa

### Fase 7: Visao Colaborador
- Aba em Meu RH
- Lista de equipamentos proprios
- Download de termos

### Fase 8: Relatorios
- Cards de metricas
- Filtros avancados
- Exportacao Excel

---

## Resumo de Arquivos a Criar/Modificar

| Tipo | Arquivo | Acao |
|------|---------|------|
| Migration | `supabase/migrations/xxx_patrimonio.sql` | Criar |
| Types | `src/types/patrimonio.ts` | Criar |
| Hooks | `src/hooks/useAssets.ts` | Criar |
| Hooks | `src/hooks/useAssetAssignments.ts` | Criar |
| Page | `src/pages/patrimonio/Index.tsx` | Criar |
| Page | `src/pages/patrimonio/Termos.tsx` | Criar |
| Page | `src/pages/patrimonio/Relatorios.tsx` | Criar |
| Component | `src/components/patrimonio/AssetFormDialog.tsx` | Criar |
| Component | `src/components/patrimonio/AssetDrawer.tsx` | Criar |
| Component | `src/components/patrimonio/AssignmentDialog.tsx` | Criar |
| Component | `src/components/patrimonio/TermoAceiteDialog.tsx` | Criar |
| Component | `src/components/patrimonio/DevolutivaDialog.tsx` | Criar |
| Component | `src/components/patrimonio/AssetHistoryTimeline.tsx` | Criar |
| App | `src/App.tsx` | Adicionar rotas |
| Menu | `src/components/layout/Sidebar.tsx` | Adicionar link |
| Types | `src/integrations/supabase/types.ts` | Auto-gerado |
