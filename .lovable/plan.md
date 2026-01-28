

# Plano: Limpeza Definitiva dos Pipelines Duplicados (Ambiente LIVE)

## Problema Identificado

O SQL foi executado no ambiente **Test** (preview), mas os dados duplicados existem no ambiente **Live** (produção). Por isso as duplicatas continuam aparecendo.

Verifiquei que os 5 grupos duplicados:
- Não possuem nenhum deal associado (0 deals cada)
- São seguros para deletar

## Solução

Você precisa executar o SQL de limpeza no **ambiente Live** (produção).

### Passo a Passo

1. Acesse o [Supabase SQL Editor](https://supabase.com/dashboard/project/rehcfgqvigfcekiipqkc/sql/new)

2. **IMPORTANTE**: No canto superior direito, altere o ambiente de "Test" para **"Live"** (produção)

3. Cole e execute este SQL:

```sql
-- LIMPEZA COMPLETA - EXECUTAR NO AMBIENTE LIVE
-- Remove 5 grupos duplicados "Lançamento / Live" criados durante testes
-- Mantém apenas o mais recente (39b2fa34...)

-- 1. Deletar webhooks associados às origens duplicadas
DELETE FROM webhook_endpoints 
WHERE origin_id IN (
  '429c41fc-5b8f-4a6a-805b-4b609e85ea04',
  '2a0b302f-1b5b-47d5-8a97-dc7d617832d7',
  '82c0dfc8-d9dc-4431-b579-bed0487e9b4f',
  'f3c87687-2221-4a51-b925-659b0e1cb3b6',
  'c6083dae-d455-407a-b01e-d31c37fc5419'
);

-- 2. Deletar stages das origens duplicadas
DELETE FROM local_pipeline_stages 
WHERE origin_id IN (
  '429c41fc-5b8f-4a6a-805b-4b609e85ea04',
  '2a0b302f-1b5b-47d5-8a97-dc7d617832d7',
  '82c0dfc8-d9dc-4431-b579-bed0487e9b4f',
  'f3c87687-2221-4a51-b925-659b0e1cb3b6',
  'c6083dae-d455-407a-b01e-d31c37fc5419'
);

-- 3. Deletar as origens duplicadas
DELETE FROM crm_origins 
WHERE id IN (
  '429c41fc-5b8f-4a6a-805b-4b609e85ea04',
  '2a0b302f-1b5b-47d5-8a97-dc7d617832d7',
  '82c0dfc8-d9dc-4431-b579-bed0487e9b4f',
  'f3c87687-2221-4a51-b925-659b0e1cb3b6',
  'c6083dae-d455-407a-b01e-d31c37fc5419'
);

-- 4. Deletar os grupos duplicados
DELETE FROM crm_groups 
WHERE id IN (
  'd57808fa-20ed-4558-8dd9-b70eef58d49b',
  '35709ad4-6e3c-4072-b778-f2e26efeebf7',
  '7c4ebef9-8c0d-446b-b363-ef4d0f313809',
  '8b343f4c-4e7c-40d4-99bf-4fc058a0a1ec',
  'af63cf7f-cd0a-4d19-b4c5-62341785b814'
);

-- 5. Verificar resultado (deve mostrar apenas 2 funis)
SELECT id, name, display_name, created_at 
FROM crm_groups 
WHERE name ILIKE '%Lançamento%'
ORDER BY created_at DESC;
```

4. Após executar, recarregue a página `/crm/negocios`

## Resultado Esperado

O dropdown "Funil" mostrará apenas:
- **Lançamento / Live** (mais recente - 39b2fa34...)
- **Lançamentos** (legado de Nov/2025 - bc0c8ca2...)

## Detalhes Técnicos

| O que será deletado | Quantidade | IDs |
|---------------------|------------|-----|
| Grupos duplicados | 5 | d57808fa, 35709ad4, 7c4ebef9, 8b343f4c, af63cf7f |
| Origens associadas | 5 | 429c41fc, 2a0b302f, 82c0dfc8, f3c87687, c6083dae |
| Stages | ~30 | (associados às origens acima) |
| Deals afetados | **0** | Nenhum deal será perdido |

## Por que não funcionou antes

O Supabase tem dois ambientes separados:
- **Test**: Dados de desenvolvimento/preview
- **Live**: Dados de produção (o que você vê na aplicação)

O SQL foi executado no Test, mas a aplicação em produção usa o Live.
