

## Problema

A Edge Function `merge-duplicate-contacts` tem a lógica de consolidação correta, mas:

1. **Não foi redeployada** após as últimas correções (sem logs recentes)
2. **Casos existentes** de 2 deals do mesmo contato na mesma origin não foram re-processados — a consolidação só acontece durante um novo merge

## Plano

### 1. Redeployar a Edge Function
Forçar o redeploy de `merge-duplicate-contacts` para garantir que a versão com consolidação de deals (incluindo `meeting_slot_attendees`) esteja ativa.

### 2. Adicionar funcionalidade de "Consolidar deals existentes"
Criar um endpoint adicional na mesma Edge Function que consolida deals duplicados na mesma origin **sem precisar de contatos duplicados**. Isso resolve os casos já existentes.

Novo parâmetro: `{ consolidate_only: true }` — busca todos os contatos que têm 2+ deals na mesma `origin_id` e executa a consolidação.

### Arquivo a alterar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/merge-duplicate-contacts/index.ts` | Adicionar modo `consolidate_only` que busca contatos com deals duplicados na mesma origin e consolida |

### Lógica do modo `consolidate_only`

```text
1. Query: SELECT contact_id, origin_id, COUNT(*) 
   FROM crm_deals 
   GROUP BY contact_id, origin_id 
   HAVING COUNT(*) > 1
2. Para cada par (contact_id, origin_id): 
   executar consolidateDeals() já existente
3. Retornar total de deals consolidados
```

### Na interface (opcional)
Adicionar um botão "Consolidar deals duplicados" na página de Contatos Duplicados que chame esse modo, permitindo limpar os casos existentes sem precisar re-mergear contatos.

### Resultado esperado
- Edge Function atualizada e redeployada
- Todos os leads com 2 deals na mesma pipeline são consolidados em 1
- O deal mais avançado (maior stage_order) é mantido, com histórico transferido

