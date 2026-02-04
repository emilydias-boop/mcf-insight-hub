
# Plano: Sistema de Automação Cross-Pipeline (Replicação de Deals)

## Objetivo

Criar um sistema configurável que, quando um Deal chega em determinada etapa (ex: "Venda Realizada"), automaticamente duplica esse Deal em outras pipelines conforme regras definidas por produto/categoria.

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     FLUXO DE AUTOMAÇÃO CROSS-PIPELINE                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Deal atualizado                                                        │
│        │                                                                 │
│        ▼                                                                 │
│   Trigger no banco ──► Verificar regras ──► Criar Deals nas destinos    │
│                         (deal_replication_rules)                         │
│                                                                          │
│   Exemplo:                                                               │
│   ┌────────────────────┐    ┌──────────────────────────────────────┐    │
│   │ Inside Sales       │    │ Destinos configurados:                │    │
│   │ "Venda Realizada"  │ ──►│ • Consórcio → "VENDA REALIZADA 50K"   │    │
│   │                    │    │ • Pós Venda → "01 - MCF PROJETOS"     │    │
│   └────────────────────┘    │ • The Club → "05 - The Club"          │    │
│                              └──────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Componentes a Criar

### 1. Nova Tabela: `deal_replication_rules`

Armazenará as regras de replicação:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `name` | text | Nome descritivo da regra |
| `source_origin_id` | uuid | Pipeline de origem (ex: Inside Sales) |
| `source_stage_id` | uuid | Etapa que dispara a automação |
| `target_origin_id` | uuid | Pipeline de destino |
| `target_stage_id` | uuid | Etapa inicial no destino |
| `match_condition` | jsonb | Condições de match (produto, tags, etc.) |
| `is_active` | boolean | Ativa/inativa a regra |
| `copy_custom_fields` | boolean | Copiar custom_fields? |
| `copy_tasks` | boolean | Gerar tasks no destino? |
| `priority` | integer | Ordem de execução |

### 2. Edge Function: `process-deal-replication`

Processa a replicação baseada nas regras configuradas:

```text
1. Receber deal_id + novo stage_id
2. Buscar regras ativas para source_origin + source_stage
3. Para cada regra:
   a. Verificar match_condition (produto, tags)
   b. Verificar se já existe deal replicado
   c. Criar novo deal na pipeline destino
   d. Copiar dados relevantes
   e. Registrar em deal_activities
```

### 3. Database Trigger: `trigger_deal_replication`

Disparar automaticamente quando `crm_deals.stage_id` muda para uma etapa configurada.

### 4. UI de Configuração

Nova seção no PipelineConfigModal:
- **Aba "Automações"** com listagem de regras
- Formulário para criar/editar regras
- Seletor de condições (produto, tags)

## Mapeamento Inicial de Produtos

Baseado na conversa, as regras iniciais seriam:

| Produto/Condição | Pipeline Destino | Etapa Destino |
|------------------|------------------|---------------|
| Parceria (A001, A009, etc.) | Efeito Alavanca + Clube | VENDA REALIZADA 50K |
| Consórcio | 04 - MCF Crédito - Consórcio | Primeira etapa |
| Crédito | 03 - MCF Crédito - Construção | Primeira etapa |
| The Club | 05 - The Club | Primeira etapa |
| Projetos | 01 - MCF PROJETOS | Primeira etapa |

## Fluxo de Dados

```text
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  UPDATE deal    │────►│ Trigger PostgreSQL   │────►│ Edge Function   │
│  stage_id = X   │     │ check_replication    │     │ process-deal-   │
│                 │     │                      │     │ replication     │
└─────────────────┘     └──────────────────────┘     └────────┬────────┘
                                                              │
                        ┌─────────────────────────────────────┘
                        ▼
              ┌─────────────────────────────────────┐
              │  Para cada regra aplicável:         │
              │  1. Verificar condições de match    │
              │  2. Evitar duplicatas               │
              │  3. INSERT novo deal na destino     │
              │  4. Copiar contato (se novo)        │
              │  5. Log em deal_activities          │
              └─────────────────────────────────────┘
```

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/migrations/XXXX_create_deal_replication_rules.sql` | Criar | Tabela + RLS + trigger |
| `supabase/functions/process-deal-replication/index.ts` | Criar | Lógica de replicação |
| `src/hooks/useDealReplicationRules.ts` | Criar | CRUD das regras |
| `src/components/crm/automations/ReplicationRulesEditor.tsx` | Criar | UI de gerenciamento |
| `src/components/crm/PipelineConfigModal.tsx` | Modificar | Adicionar aba "Automações" |

## Detalhes Técnicos

### Estrutura do `match_condition` (JSONB)

```json
{
  "type": "product_name",
  "operator": "contains",
  "values": ["A001", "A009", "PARCERIA"]
}
```

Ou para tags:
```json
{
  "type": "tags",
  "operator": "includes_any",
  "values": ["parceria", "consorcio-50k"]
}
```

### Prevenção de Duplicatas

Antes de criar o deal replicado:
1. Verificar se já existe deal com mesmo `contact_id` + `origin_id`
2. Verificar campo `replicated_from_deal_id` para evitar loops

### Campos Copiados no Deal Replicado

- `name` (nome do deal)
- `contact_id` (referência ao mesmo contato)
- `value` (valor da venda)
- `custom_fields` (se configurado)
- `owner_id` (manter ou usar distribuição)
- `replicated_from_deal_id` (novo campo para rastreabilidade)
- `replicated_at` (timestamp)

## Benefícios

1. **Configurável**: Regras podem ser criadas/editadas pela UI
2. **Rastreável**: Todo deal replicado tem referência ao original
3. **Flexível**: Condições por produto, tags, ou ambos
4. **Seguro**: RLS aplicado, sem loops infinitos
5. **Escalável**: Múltiplas regras por pipeline

## Próximos Passos (Implementação)

1. Criar migration com tabela + trigger
2. Criar Edge Function de processamento
3. Criar hooks React para gerenciar regras
4. Criar UI de configuração
5. Configurar regras iniciais baseadas no mapeamento definido
6. Testar fluxo completo
