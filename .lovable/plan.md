

# Limpeza Completa dos Pipelines Duplicados

## Problema Identificado

Há **6 grupos** duplicados chamados "Lançamento" criados durante os testes, cada um com sua própria origem e stages:

| Grupo ID | Criado às | Stages | Deve Manter? |
|----------|-----------|--------|--------------|
| 39b2fa34... | 00:00:26 | 6 | ✅ SIM (mais recente) |
| d57808fa... | 23:56:57 | 7 | ❌ Deletar |
| 35709ad4... | 23:55:06 | 6 | ❌ Deletar |
| 7c4ebef9... | 23:55:00 | 6 | ❌ Deletar |
| 8b343f4c... | 23:52:22 | 6 | ❌ Deletar |
| af63cf7f... | 23:52:17 | 6 | ❌ Deletar |

O grupo mais antigo "Lançamentos" (bc0c8ca2...) de Nov/2025 é **diferente** e deve ser mantido.

## Solução: SQL de Limpeza Completa

Execute este SQL no **Supabase SQL Editor** para remover todos os duplicados:

```sql
-- LIMPEZA DE PIPELINES DUPLICADOS "LANÇAMENTO"
-- Manter apenas o mais recente (39b2fa34...) e o legado "Lançamentos" (bc0c8ca2...)

-- 1. Deletar webhook endpoint órfão (se houver)
DELETE FROM webhook_endpoints 
WHERE origin_id IN (
  'd57808fa-20ed-4558-8dd9-b70eef58d49b', -- 23:56
  '35709ad4-6e3c-4072-b778-f2e26efeebf7', -- 23:55:06
  '7c4ebef9-8c0d-446b-b363-ef4d0f313809', -- 23:55:00
  '8b343f4c-4e7c-40d4-99bf-4fc058a0a1ec', -- 23:52:22
  'af63cf7f-cd0a-4d19-b4c5-62341785b814'  -- 23:52:17
);

-- 2. Deletar stages associados às origens duplicadas
DELETE FROM local_pipeline_stages 
WHERE origin_id IN (
  '429c41fc-5b8f-4a6a-805b-4b609e85ea04',
  '2a0b302f-1b5b-47d5-8a97-dc7d617832d7',
  '82c0dfc8-d9dc-4431-b579-bed0487e9b4f',
  'f3c87687-2221-4a51-b925-659b0e1cb3b6',
  'c6083dae-d455-407a-b01e-d31c37fc5419'
);

-- 3. Deletar origens duplicadas
DELETE FROM crm_origins 
WHERE id IN (
  '429c41fc-5b8f-4a6a-805b-4b609e85ea04',
  '2a0b302f-1b5b-47d5-8a97-dc7d617832d7',
  '82c0dfc8-d9dc-4431-b579-bed0487e9b4f',
  'f3c87687-2221-4a51-b925-659b0e1cb3b6',
  'c6083dae-d455-407a-b01e-d31c37fc5419'
);

-- 4. Deletar grupos duplicados
DELETE FROM crm_groups 
WHERE id IN (
  'd57808fa-20ed-4558-8dd9-b70eef58d49b',
  '35709ad4-6e3c-4072-b778-f2e26efeebf7',
  '7c4ebef9-8c0d-446b-b363-ef4d0f313809',
  '8b343f4c-4e7c-40d4-99bf-4fc058a0a1ec',
  'af63cf7f-cd0a-4d19-b4c5-62341785b814'
);

-- Verificar resultado
SELECT id, name, created_at FROM crm_groups 
WHERE name ILIKE '%Lançamento%' OR name ILIKE '%Live%'
ORDER BY created_at DESC;
```

## Resultado Esperado

Após a limpeza, o dropdown "Funil" mostrará apenas:
- **Lançamento** (39b2fa34... - criado em 00:00:26) - funcional com 6 stages
- **Lançamentos** (bc0c8ca2... - legado de Nov/2025)

## Passos

1. Acesse o [Supabase SQL Editor](https://supabase.com/dashboard/project/rehcfgqvigfcekiipqkc/sql/new)
2. Cole e execute o SQL acima
3. Recarregue a página /crm/negocios para ver a lista limpa

