

## Contexto

O Lucas tem 2 contatos duplicados, cada um com 1 deal na **mesma pipeline** (Inside Sales):
- **Contact c8d83183** → Deal "Lucas" em **Contrato Pago** (stage avançado)
- **Contact ef4eb45f** → Deal "Lucas Ângelo" em **Reunião 02 Realizada** (com R1 registrada)

O usuário esclarece: deveria ser **1 contato com 1 deal**, não 2 deals. A entrada dupla provavelmente veio de uma transferência do Clint (nome completo) vs webhook (nome+sobrenome).

### Problema atual do merge

O merge atual **transfere todos os deals** dos duplicados para o primary → resultado: 1 contato com **2 deals na mesma origin**. Mas o correto é consolidar em 1 deal só (o mais avançado), transferindo reuniões e atividades do deal descartado para o deal mantido.

## Plano: Merge com consolidação de deals na mesma origin

### Mudança na Edge Function `merge-duplicate-contacts`

Após transferir os deals dos duplicados para o primary, adicionar uma etapa de **consolidação de deals por origin**:

1. **Buscar deals do primary agrupados por `origin_id`**
2. **Para cada origin com 2+ deals**: manter o deal com maior `stage_order`, transferir `meeting_slots` e `deal_activities` do deal descartado para o deal mantido, depois deletar o deal descartado
3. **Merge de tags/custom_fields** do deal descartado para o mantido (union de tags, preservar custom_fields não-nulos)

### Lógica de consolidação de deals

```text
Para cada origin_id com múltiplos deals:
  1. Ordenar deals por stage_order DESC
  2. Primary deal = deal com maior stage_order
  3. Para cada deal secundário:
     - UPDATE meeting_slots SET deal_id = primary_deal WHERE deal_id = secondary_deal
     - UPDATE deal_activities SET deal_id = primary_deal WHERE deal_id = secondary_deal
     - Merge tags do secondary no primary (union)
     - DELETE crm_deals WHERE id = secondary_deal
```

### Arquivo a alterar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/merge-duplicate-contacts/index.ts` | Após transferir deals, consolidar deals duplicados na mesma origin: manter o mais avançado, transferir meetings/activities, deletar o secundário |

### O que NÃO muda
- Deals em origins **diferentes** são mantidos (é válido ter 1 deal no Consórcio e 1 no Inside Sales)
- `owner_id` do deal mantido permanece inalterado
- Nenhum arquivo de frontend alterado

### Resultado esperado (caso Lucas)
- 1 contato (c8d83183, com email)
- 1 deal em Inside Sales: "Lucas" em **Contrato Pago**, com a R1 e reuniões do deal antigo transferidas para ele

