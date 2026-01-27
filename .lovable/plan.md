
# Plano: Wizard de Criação de Pipeline

## Visão Geral

Implementar um wizard guiado de 5 etapas para criar novos Pipelines (grupos) e Origins (sub-pipelines) diretamente pela interface do CRM, substituindo a necessidade de inserções manuais no banco de dados.

## Estrutura do Wizard

```text
┌─────────────────────────────────────────────────────────────────────┐
│  [1. Info] → [2. Stages] → [3. Distribution] → [4. Integrations]   │
│                                  ↓                                  │
│                           [5. Review & Create]                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Etapa 1: Informações Básicas
- Nome do Pipeline (obrigatório)
- Nome de Exibição (opcional)
- Descrição (opcional)
- Tipo: Pipeline (grupo) ou Origin (sub-pipeline de um grupo existente)
- Se Origin: selecionar grupo pai

### Etapa 2: Etapas do Kanban
- Lista inicial de stages com valores padrão sugeridos (Novo Lead, Qualificado, Agendada, Realizada, Ganho, Perdido)
- Drag-and-drop para reordenar
- Adicionar/remover/editar stages
- Seleção de cores e tipos (normal, won, lost)

### Etapa 3: Distribuição de Leads
- Adicionar usuários responsáveis (SDRs/Closers)
- Configurar percentuais
- Ativar/desativar usuários
- Distribuir igualmente

### Etapa 4: Integrações (Opcional)
- Configurar webhook de entrada (URL para receber leads)
- Auto-tags para leads recebidos
- Stage inicial para novos leads

### Etapa 5: Revisão e Criação
- Resumo de todas as configurações
- Botão para criar pipeline
- Exibir resultado com link para o novo pipeline

---

## Componentes a Criar

| Componente | Descrição |
|------------|-----------|
| `CreatePipelineWizard.tsx` | Modal principal com navegação entre etapas |
| `WizardStepInfo.tsx` | Etapa 1: nome, descrição, tipo |
| `WizardStepStages.tsx` | Etapa 2: configuração de stages |
| `WizardStepDistribution.tsx` | Etapa 3: distribuição de leads |
| `WizardStepIntegrations.tsx` | Etapa 4: webhooks e integrações |
| `WizardStepReview.tsx` | Etapa 5: revisão e confirmação |
| `useCreatePipeline.ts` | Hook para criar pipeline, stages e configs |

---

## Detalhes Técnicos

### Tabelas Envolvidas

| Tabela | Operação | Descrição |
|--------|----------|-----------|
| `crm_groups` | INSERT | Criar novo pipeline (grupo) |
| `crm_origins` | INSERT | Criar nova origin (sub-pipeline) |
| `local_pipeline_stages` | INSERT (batch) | Criar etapas do Kanban |
| `lead_distribution_config` | INSERT (batch) | Configurar distribuição |
| `webhook_endpoints` | INSERT | Configurar webhook de entrada |

### Schema de Dados

**crm_groups:**
```typescript
{
  id: UUID (auto),
  clint_id: string, // "local-group-{timestamp}"
  name: string,
  display_name?: string,
  description?: string,
  is_archived: false
}
```

**crm_origins:**
```typescript
{
  id: UUID (auto),
  clint_id: string, // "local-origin-{timestamp}"
  name: string,
  display_name?: string,
  description?: string,
  group_id?: UUID,
  pipeline_type: 'outros',
  is_archived: false
}
```

**local_pipeline_stages:**
```typescript
{
  id: UUID (auto),
  name: string,
  color: string,
  stage_order: number,
  stage_type: 'normal' | 'won' | 'lost',
  origin_id?: UUID,
  group_id?: UUID
}
```

### Stages Padrão Sugeridos

```typescript
const defaultStages = [
  { name: 'Novo Lead', color: '#3b82f6', stage_type: 'normal' },
  { name: 'Lead Qualificado', color: '#8b5cf6', stage_type: 'normal' },
  { name: 'R1 Agendada', color: '#f59e0b', stage_type: 'normal' },
  { name: 'R1 Realizada', color: '#10b981', stage_type: 'normal' },
  { name: 'Contrato Pago', color: '#10b981', stage_type: 'won' },
  { name: 'Sem Interesse', color: '#ef4444', stage_type: 'lost' },
];
```

---

## Interface do Wizard

### Layout do Modal

```text
┌─────────────────────────────────────────────────────────────────┐
│  ✕  Criar Novo Pipeline                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [●──○──○──○──○]  Etapa 1 de 5: Informações Básicas            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  Tipo de Pipeline                                         │ │
│  │  ○ Pipeline (grupo de origins)                           │ │
│  │  ● Origin (sub-pipeline)                                  │ │
│  │                                                           │ │
│  │  Grupo Pai (se origin)                                    │ │
│  │  [ Hubla - Construir Para Alugar          ▼ ]            │ │
│  │                                                           │ │
│  │  Nome *                                                   │ │
│  │  [ Nome do pipeline ]                                     │ │
│  │                                                           │ │
│  │  Nome de Exibição                                         │ │
│  │  [ Nome amigável para o usuário ]                         │ │
│  │                                                           │ │
│  │  Descrição                                                │ │
│  │  [ Descrição opcional do pipeline ]                       │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                            [Cancelar]  [Próximo →]              │
└─────────────────────────────────────────────────────────────────┘
```

### Navegação

- Indicador de progresso visual (stepper com 5 pontos)
- Botões "Voltar" e "Próximo" em cada etapa
- Validação antes de avançar
- Etapas 3 e 4 são opcionais (podem ser puladas)

---

## Ponto de Entrada

### Botão "Criar Pipeline" na Sidebar

Adicionar um botão fixo no topo da `OriginsSidebar.tsx` que abre o wizard:

```tsx
<Button 
  variant="outline" 
  size="sm" 
  className="w-full" 
  onClick={() => setWizardOpen(true)}
>
  <Plus className="h-4 w-4 mr-2" />
  Criar Pipeline
</Button>
```

---

## Fluxo de Criação

```text
1. Usuário clica "Criar Pipeline" na sidebar
                    ↓
2. Wizard abre na Etapa 1
                    ↓
3. Usuário preenche informações básicas
                    ↓
4. Etapa 2: Configura stages (pode usar padrões)
                    ↓
5. Etapa 3: (Opcional) Configura distribuição
                    ↓
6. Etapa 4: (Opcional) Configura webhook
                    ↓
7. Etapa 5: Revisa e confirma
                    ↓
8. Sistema cria:
   - crm_groups ou crm_origins
   - local_pipeline_stages
   - lead_distribution_config (se configurado)
   - webhook_endpoints (se configurado)
                    ↓
9. Toast de sucesso + redireciona para o novo pipeline
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/crm/wizard/CreatePipelineWizard.tsx` | CRIAR | Modal principal do wizard |
| `src/components/crm/wizard/WizardStepInfo.tsx` | CRIAR | Etapa 1: informações |
| `src/components/crm/wizard/WizardStepStages.tsx` | CRIAR | Etapa 2: stages |
| `src/components/crm/wizard/WizardStepDistribution.tsx` | CRIAR | Etapa 3: distribuição |
| `src/components/crm/wizard/WizardStepIntegrations.tsx` | CRIAR | Etapa 4: integrações |
| `src/components/crm/wizard/WizardStepReview.tsx` | CRIAR | Etapa 5: revisão |
| `src/components/crm/wizard/WizardProgress.tsx` | CRIAR | Componente de progresso |
| `src/hooks/useCreatePipeline.ts` | CRIAR | Hook para criação |
| `src/components/crm/OriginsSidebar.tsx` | MODIFICAR | Adicionar botão de criar |

---

## Validações

### Etapa 1
- Nome é obrigatório
- Nome não pode ser duplicado (verificar no banco)
- Se tipo = Origin, grupo pai é obrigatório

### Etapa 2
- Pelo menos 1 stage é obrigatório
- Deve ter pelo menos 1 stage de tipo "won" ou "lost"
- Nomes de stages não podem ser duplicados

### Etapa 3 (Opcional)
- Se configurar distribuição, total deve ser 100%

### Etapa 4 (Opcional)
- Slug do webhook deve ser único

---

## Resultado Esperado

Após implementação, o usuário poderá:

1. Criar novos Pipelines (grupos) diretamente pela UI
2. Criar novas Origins dentro de grupos existentes
3. Configurar stages iniciais com drag-and-drop
4. Opcionalmente configurar distribuição de leads
5. Opcionalmente configurar webhook para receber leads
6. Visualizar o novo pipeline imediatamente no Kanban
