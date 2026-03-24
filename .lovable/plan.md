

## Plano: Merge seguro priorizando deals avançados (stage_order)

### Problema atual

O merge seleciona o contato "primary" por **mais deals > mais reuniões > mais antigo**. Isso ignora completamente o estágio do funil. Um contato com 2 deals em "LEAD SCORE" seria mantido sobre um com 1 deal em "R1 Realizada".

### Mudança

Alterar a função `mergeContacts` em `supabase/functions/merge-duplicate-contacts/index.ts` para:

1. **Buscar stage_order dos deals** — fazer join com `crm_stages` para obter o `order` de cada deal
2. **Novo critério de seleção do primary**: `max(stage_order)` > mais deals > mais reuniões > mais antigo
   - O contato cujo deal está mais avançado no funil vira o primary
3. **Enriquecer o primary** — preencher email/phone/tags faltantes com dados do duplicado
4. **Transferir todos os deals** — nenhum deal é deletado, apenas o `contact_id` dos deals do duplicado é atualizado para apontar pro primary

### Exemplo concreto (Anna)

| Contato | Deal Stage | stage_order |
|---------|-----------|-------------|
| Anna (id: A) | R1 Realizada | 12 |
| Anna (id: B) | LEAD SCORE | 3 |

**Resultado**: Anna A (R1 Realizada) é mantida como primary. O deal de LEAD SCORE é transferido para ela. Contato B é deletado.

### Arquivo a alterar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/merge-duplicate-contacts/index.ts` | Na query de contatos, incluir join com `crm_stages` via `crm_deals.stage_id`; reordenar critério de seleção para priorizar `max(stage.order)`; adicionar merge de tags e enriquecimento de email/phone |

### O que NÃO muda
- Nenhum deal é deletado — todos são transferidos
- `meeting_slots` e `deal_activities` continuam vinculados ao `deal_id` (não ao contact_id)
- `owner_id` dos deals permanece inalterado
- O webhook `clientdata-inside` não é afetado

### Execução sugerida
Após implementar, rodar primeiro com `dry_run: true` para validar quem será o primary de cada par antes de executar de fato.

