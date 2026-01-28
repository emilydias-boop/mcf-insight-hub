

# Limpeza de Dados Legados e Correção do Wizard

## Diagnóstico

O wizard de criação de pipelines **já está funcionando corretamente** após as correções feitas. As origens e grupos criados sem stages são **resíduos das tentativas anteriores** durante o período de bugs (23:48 - 23:51).

### Prova do funcionamento atual:
| Criado às | Origin ID | Stages |
|-----------|-----------|--------|
| 00:00:26 | 3228de9a... | 6 stages ✅ |
| 23:56:57 | 429c41fc... | 6 stages ✅ |
| 23:55:06 | 2a0b302f... | 6 stages ✅ |
| 23:55:00 | 82c0dfc8... | 6 stages ✅ |
| 23:52:22 | f3c87687... | 6 stages ✅ |
| 23:52:17 | c6083dae... | 6 stages ✅ |
| **23:51:03** | **90333457...** | **0 stages** ❌ (antes da correção) |
| **23:49:58** | **735336d1...** | **0 stages** ❌ (antes da correção) |
| **23:48:41** | **e62fdc3e...** | **0 stages** ❌ (antes da correção) |

## Solução

### Passo 1: Limpar dados duplicados
Executar SQL no Supabase para remover as origens e grupos duplicados criados sem stages:

```sql
-- 1. Identificar e remover origens sem stages criadas após 23:48
DELETE FROM crm_origins 
WHERE id IN (
  '90333457-7fa1-4903-8b01-e5f73a8665d2',
  '735336d1-88a7-4024-b012-19d916aff69c',
  'e62fdc3e-1a6a-4702-9ad4-74a0cd01d9b3'
);

-- 2. Remover grupos órfãos (que ficaram sem origens)
DELETE FROM crm_groups 
WHERE id IN (
  '403f5335-b61f-452b-8a62-c9bae36f9280',
  '9df77a6f-397d-4262-a3a2-936e0acfe38d',
  '58766888-b7cc-4340-8ca4-18ddbb024cbb'
);
```

### Passo 2: Remover duplicatas restantes (opcional)
Se quiser manter apenas uma cópia de "Lançamento / Live":

```sql
-- Ver todas as cópias funcionais
SELECT g.id, g.name, g.created_at,
       (SELECT o.id FROM crm_origins o WHERE o.group_id = g.id LIMIT 1) as origin_id
FROM crm_groups g
WHERE g.name LIKE 'Lançamento%'
AND g.created_at > '2026-01-27 23:52:00'
ORDER BY g.created_at;

-- Deletar as cópias excedentes mantendo apenas a mais recente
-- (executar após identificar qual manter)
```

## Resultado Esperado

Após a limpeza:
- O dropdown "Funil" mostrará apenas uma entrada para cada pipeline
- Todas as origens terão suas stages configuradas
- O wizard continuará funcionando normalmente para novas criações

## Verificação

O sistema está funcionando corretamente - não há bugs a corrigir no código. Apenas dados legados a serem removidos.

