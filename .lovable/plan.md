

## Diagnóstico: Duplicação de transações `newsale-`

### Problema
A função RPC `get_hubla_transactions_by_bu` filtra por `source IN ('hubla', 'manual')`, o que inclui transações `newsale-` (que têm `source = 'hubla'`). Essas transações são duplicatas "fantasma" criadas pelo webhook antes do processamento completo — sempre com `net_value = 0`. A transação real (com `hubla_id` UUID) chega depois e contém o valor correto.

Exemplo do Yuri Pereira de Oliveira:
- `hubla_id: 06e25043-...` → A000 Contrato, R$ 497, net R$ 460,76 (real)
- `hubla_id: newsale-1772131004213` → A000 Contrato, R$ 497, net R$ 0 (duplicata)

A deduplicação classifica a segunda como "Recorrente" e zera o bruto, mas ela ainda aparece na lista — causando confusão visual.

### Solução
Excluir transações `newsale-%` na RPC `get_hubla_transactions_by_bu`, da mesma forma que já é feito em `get_all_hubla_transactions` (que tem `AND ht.hubla_id NOT ILIKE 'newsale-%'`).

### Etapa única

**Migração SQL** — adicionar filtro `AND ht.hubla_id NOT ILIKE 'newsale-%'` na função `get_hubla_transactions_by_bu`:

```sql
CREATE OR REPLACE FUNCTION public.get_hubla_transactions_by_bu(...)
  -- Adicionar na cláusula WHERE:
  AND ht.hubla_id NOT ILIKE 'newsale-%'
```

Isso remove as linhas duplicadas fantasma sem afetar nenhuma transação real. Zero impacto em outras funcionalidades — a mesma exclusão já existe na RPC `get_all_hubla_transactions`.

