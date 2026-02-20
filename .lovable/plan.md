

# Corrigir erro "foreign key constraint crm_deals_stage_id_fkey" ao mover lead

## Problema

Ao arrastar um lead no Kanban do pipeline "Efeito Alavanca + Clube", o sistema retorna o erro:

> insert or update on table "crm_deals" violates foreign key constraint "crm_deals_stage_id_fkey"

Isso acontece porque 2 estagios desse pipeline existem na tabela `local_pipeline_stages` mas **nao foram espelhados** na tabela legada `crm_stages`. Como `crm_deals.stage_id` tem uma FK apontando para `crm_stages.id`, mover um deal para esses estagios falha.

### Estagios faltando no espelhamento

| ID | Nome |
|---|---|
| `2357df56-bfad-4c4c-b37b-c5f41ce08af6` | PRODUTOS FECHADOS |
| `91fcdb43-0103-4f9d-881c-f5c6dabe3c97` | SEM INTERESSE |

## Solucao

Executar uma migracao SQL que insere os 2 estagios ausentes na tabela `crm_stages`, usando os mesmos UUIDs da `local_pipeline_stages`. Isso restaura o espelhamento e permite que o FK seja satisfeito.

## Detalhes tecnicos

### Migracao SQL

```sql
INSERT INTO crm_stages (id, stage_name, stage_order, is_active, origin_id)
VALUES
  ('2357df56-bfad-4c4c-b37b-c5f41ce08af6', 'PRODUTOS FECHADOS', 100, true, '7d7b1cb5-2a44-4552-9eff-c3b798646b78'),
  ('91fcdb43-0103-4f9d-881c-f5c6dabe3c97', 'SEM INTERESSE', 101, true, '7d7b1cb5-2a44-4552-9eff-c3b798646b78')
ON CONFLICT (id) DO NOTHING;
```

### Impacto
- Nenhuma mudanca de codigo no frontend
- Apenas 1 migracao SQL adicionando 2 registros
- Corrige imediatamente o erro ao arrastar leads para "PRODUTOS FECHADOS" ou "SEM INTERESSE"

