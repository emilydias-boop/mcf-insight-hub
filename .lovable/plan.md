
# Plano: Corrigir Erro - Remover Referência a Coluna Inexistente

## Problema

A migração anterior criou a função `get_all_hubla_transactions()` com uma cláusula que referencia `pc_parent.child_offer_ids`, porém essa coluna **não existe** na tabela `product_configurations`.

### Erro Exato
```
column pc_parent.child_offer_ids does not exist
```

### Colunas Existentes em `product_configurations`
| Coluna | Tipo |
|--------|------|
| id | uuid |
| product_name | text |
| product_code | text |
| display_name | text |
| product_category | text |
| target_bu | text |
| reference_price | numeric |
| is_active | boolean |
| count_in_dashboard | boolean |
| notes | text |
| created_at | timestamp |
| updated_at | timestamp |

**Nota**: `child_offer_ids` não existe.

---

## Solução

Atualizar a função `get_all_hubla_transactions()` removendo a cláusula que tenta acessar `child_offer_ids`.

### Trecho a Remover

```sql
-- Esta parte deve ser REMOVIDA:
AND NOT EXISTS (
  SELECT 1 FROM product_configurations pc_parent
  WHERE pc_parent.child_offer_ids IS NOT NULL
    AND ht.hubla_id = ANY(pc_parent.child_offer_ids)
)
```

A lógica de exclusão de transações make duplicadas permanece intacta.

---

## Detalhes Técnicos

### Nova Migração SQL

Recriar a função sem a referência à coluna inexistente, mantendo apenas:
1. Filtros básicos (status, source)
2. Lógica de exclusão de make duplicados (que já funciona corretamente)
3. Filtros de busca e data

---

## Impacto

- A página de transações voltará a funcionar
- As transações serão exibidas corretamente
- A lógica de exclusão de make duplicados continuará funcionando
