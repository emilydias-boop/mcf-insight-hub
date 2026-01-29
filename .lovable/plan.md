
# Plano: Criar BU de Leilão no CRM

## Objetivo

Criar uma nova Business Unit (BU) de Leilão no sistema CRM com:
- Pipeline Kanban completo para gerenciar leads/deals de leilão
- Integração pronta para receber leads via webhook
- Controle de acesso baseado em BU (quem é do time de leilão só vê leads de leilão)

---

## Estrutura a Ser Criada

```text
📁 BU - LEILÃO (crm_groups)
   └── 📋 Pipeline Leilão (crm_origins)
       ├── Novo Lead
       ├── Em Contato
       ├── Lead Qualificado
       ├── Proposta Enviada
       ├── Análise Documental
       ├── Contrato
       └── Sem Interesse
```

---

## Etapas de Implementação

### Etapa 1: Criar Grupo e Origem no Banco (SQL)

**Ação**: Executar script SQL para criar o grupo e a origem

```sql
-- 1. Criar Grupo (funil principal)
INSERT INTO crm_groups (id, clint_id, name, display_name, is_archived)
VALUES (
  gen_random_uuid(),
  'local-group-bu-leilao',
  'BU - LEILÃO',
  'BU - LEILÃO',
  false
) RETURNING id;

-- 2. Criar Origem (pipeline) vinculada ao grupo
INSERT INTO crm_origins (id, clint_id, name, display_name, group_id, pipeline_type, is_archived)
VALUES (
  gen_random_uuid(),
  'local-origin-leilao-pipeline',
  'Pipeline Leilão',
  'Pipeline Leilão',
  (SELECT id FROM crm_groups WHERE clint_id = 'local-group-bu-leilao'),
  'outros',
  false
) RETURNING id;

-- 3. Criar etapas do Kanban
INSERT INTO local_pipeline_stages (origin_id, name, stage_order, is_active, stage_type, color)
SELECT 
  (SELECT id FROM crm_origins WHERE clint_id = 'local-origin-leilao-pipeline'),
  stage.name,
  stage.stage_order,
  true,
  stage.stage_type,
  stage.color
FROM (VALUES
  ('Novo Lead', 0, 'active', '#3B82F6'),
  ('Em Contato', 1, 'active', '#8B5CF6'),
  ('Lead Qualificado', 2, 'active', '#10B981'),
  ('Proposta Enviada', 3, 'active', '#F59E0B'),
  ('Análise Documental', 4, 'active', '#6366F1'),
  ('Contrato Assinado', 5, 'won', '#22C55E'),
  ('Sem Interesse', 6, 'lost', '#EF4444')
) AS stage(name, stage_order, stage_type, color);
```

---

### Etapa 2: Atualizar Código Frontend

#### 2.1 Adicionar "leilao" ao tipo BusinessUnit

**Arquivo**: `src/hooks/useMyBU.ts`

```typescript
// Antes:
export type BusinessUnit = 'incorporador' | 'consorcio' | 'credito' | 'projetos';

// Depois:
export type BusinessUnit = 'incorporador' | 'consorcio' | 'credito' | 'projetos' | 'leilao';

// Adicionar opção no BU_OPTIONS:
{ value: "leilao", label: "BU - Leilão" },
```

#### 2.2 Adicionar mapeamento de pipelines para a nova BU

**Arquivo**: `src/components/auth/NegociosAccessGuard.tsx`

```typescript
// Adicionar no BU_PIPELINE_MAP:
leilao: ['<ID_DA_ORIGEM_CRIADA>'], // Pipeline Leilão

// Adicionar no BU_DEFAULT_ORIGIN_MAP:
leilao: '<ID_DA_ORIGEM_CRIADA>',

// Adicionar no BU_DEFAULT_GROUP_MAP:
leilao: '<ID_DO_GRUPO_CRIADO>',
```

---

### Etapa 3: Configurar Webhook de Entrada (Opcional)

Se você quiser receber leads de uma fonte externa (formulário, plataforma de leilão):

1. Acessar a Pipeline "Pipeline Leilão" no CRM
2. Clicar em ⋮ → Configurações
3. Ir em Integrações → Webhooks de Entrada
4. Criar novo webhook com slug (ex: `leilao-leads`)
5. O endpoint gerado será: `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/webhook-lead-receiver?slug=leilao-leads`

---

## Resumo das Alterações

| Componente | Ação |
|------------|------|
| Banco de Dados | Criar grupo, origem e etapas via SQL |
| `useMyBU.ts` | Adicionar tipo `leilao` e opção no dropdown |
| `NegociosAccessGuard.tsx` | Adicionar mapeamentos de ID para a BU |
| CRM UI | Webhook de entrada pode ser criado via interface |

---

## Resultado Esperado

- Nova BU "Leilão" aparecerá no sidebar do CRM
- Usuários com squad = "leilao" verão apenas a pipeline de leilão
- Pipeline terá Kanban com 7 etapas prontas
- Pronto para receber leads via webhook ou criação manual

---

## Observação sobre o Webhook Consórcio

O webhook `webhook-consorcio` que você mencionou insere dados na tabela `consortium_cards` (gestão de cartas de consórcio), **não** no CRM de deals. Se quiser integrar leads de leilão no CRM, usaremos o sistema de `webhook-lead-receiver` que já existe e cria deals no Kanban.

Se precisar de um webhook específico para leilão similar ao consórcio (com tabela própria para contratos de leilão), isso seria um desenvolvimento adicional.
