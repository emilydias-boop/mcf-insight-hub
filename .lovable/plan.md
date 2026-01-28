
# Correção do Status de Wenderson + Remoção do Botão Contrato Pago

## Parte 1: SQL para Reverter Wenderson para No-Show

Execute este SQL no Supabase (Cloud View > Run SQL):

```sql
-- 1. Reverter o attendee para no_show
UPDATE meeting_slot_attendees
SET 
  status = 'no_show',
  contract_paid_at = NULL,
  updated_at = NOW()
WHERE id = 'dfc31d56-0ad0-4467-86b6-3e983b6d8247';

-- 2. Reverter o meeting slot para scheduled (já que o lead é no-show)
UPDATE meeting_slots
SET 
  status = 'scheduled',
  updated_at = NOW()
WHERE id = '7e51df8c-7bca-4ed6-bff9-f76f3dd69e02';

-- 3. Atualizar o deal para No-Show stage (opcional - depende se quer mover no CRM)
-- UPDATE crm_deals
-- SET stage_id = '6bb76ad9-3d48-4e91-b24a-c6e8e18d9e9e' -- No-Show stage
-- WHERE id = '779915e5-744a-49bb-ac3a-602b60e12abb';
```

---

## Parte 2: Remover Botão "Contrato Pago" do R1 Drawer

### Modificação no arquivo

**Arquivo:** `src/components/crm/AgendaMeetingDrawer.tsx`

**Alteração:** Remover o botão "Contrato Pago" interativo, mas manter a exibição visual (badge) quando o status for `contract_paid` (marcado pela automação).

### Lógica proposta

1. Remover o botão clicável de "Contrato Pago" (linhas 967-982)
2. Manter o badge de status "Contrato Pago" visível quando a automação marcar
3. Usuário continua vendo badges coloridos indicando o status atual

### Interface resultante

| Status | Antes | Depois |
|--------|-------|--------|
| Agendada | Botão ativo | Botão ativo |
| Realizada | Botão ativo | Botão ativo |
| No-Show | Botão ativo | Botão ativo |
| Contrato Pago | Botão ativo clicável | Badge indicativo (sem ação) |

Assim, quando a automação (webhook) marcar como `contract_paid`, o usuário verá o badge "Contrato Pago" no topo, mas não terá mais a opção de marcar manualmente.

---

## Arquivos a modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/crm/AgendaMeetingDrawer.tsx` | Remover botão "Contrato Pago" e functions relacionadas |

---

## Resultado esperado

1. Wenderson reverte para "No-show" imediatamente após rodar o SQL
2. Botão "Contrato Pago" não aparece mais para marcação manual
3. Badge "Contrato Pago" continua visível quando automação detectar pagamento
4. Workflow de status fica: Agendada ↔ Realizada ↔ No-Show (automação marca CP)
