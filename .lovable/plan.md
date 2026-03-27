

## Distribuicao automatica na replicacao cross-pipeline

### Problema
Quando um deal e replicado para a pipeline de destino, ele chega sem dono (`owner_id = NULL`). O usuario precisa que a regra de replicacao ja defina como o deal sera distribuido na pipeline destino — usando o sistema de distribuicao equitativa (`get_next_lead_owner`) que ja existe.

### Solucao

Adicionar uma opcao de **"Distribuicao automatica"** na regra de replicacao, que ao criar o deal replicado, chama `get_next_lead_owner(target_origin_id)` para atribuir um dono automaticamente.

### Alteracoes

**1. Migration — Novo campo na tabela `deal_replication_rules`**
- `auto_distribute BOOLEAN DEFAULT false` — habilita a distribuicao automatica via `get_next_lead_owner`

**2. Edge Function `process-deal-replication/index.ts`**
- Apos criar o deal replicado, se `rule.auto_distribute = true`:
  - Chamar `get_next_lead_owner(rule.target_origin_id)` via RPC
  - Atualizar o deal replicado com o `owner_id` retornado
  - Resolver `owner_profile_id` pelo email (trigger `sync_owner_profile_id` ja faz isso)
  - Registrar o owner atribuido nos logs e atividades

**3. Frontend — `ReplicationRulesEditor.tsx`**
- Adicionar toggle "Distribuir automaticamente" no formulario (ao lado dos toggles existentes de "Ativa" e "Copiar campos")
- Quando ativo, mostrar um indicador de que a `lead_distribution_config` da pipeline destino sera usada
- Exibir na listagem de regras se a distribuicao esta ativa (badge)

**4. Hook `useDealReplicationRules.ts`**
- Adicionar `auto_distribute` ao tipo `DealReplicationRule` e `CreateReplicationRuleInput`

**5. Types `supabase/types.ts`**
- Sera regenerado automaticamente apos a migration

### Fluxo resultante

```text
Deal atinge etapa trigger
  → Regra de replicacao dispara
    → Cria deal na pipeline destino
    → Se auto_distribute = true:
        → get_next_lead_owner(target_origin_id) → "sdr@email.com"
        → owner_id = "sdr@email.com"
        → Log: "Replicado e distribuido para sdr@email.com"
```

### Pre-requisito
A pipeline de destino precisa ter `lead_distribution_config` configurada com SDRs ativos. Se nao houver configuracao, o deal sera criado sem dono (comportamento atual) e um warning sera logado.

