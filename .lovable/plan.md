

## Diagnóstico e Plano de Correção

### Problemas Encontrados

**1. Vinicius "Recorrente" → Já corrigido**
A transação `105204dc` (A000 - Contrato) do Vinicius JÁ consta como "Novo" na RPC `get_first_transaction_ids`. O attendee dele está corretamente configurado (`contract_paid_at: 2026-04-13`, `status: contract_paid`, closer: Mateus Macedo, SDR/booked_by vinculado). O "Recorrente" que aparece na tela é **cache do React Query** (staleTime de 5 minutos). Basta atualizar a página para corrigir.

**2. Caio Belardi — Transação nova não vinculada ao attendee**
Este é o problema real. Dados atuais:

```text
R1 Attendee (9cf5a424):
  status: contract_paid
  contract_paid_at: 2026-03-03  ← data da transação REEMBOLSADA
  linked tx: cb226517 (refunded)

Nova transação (fcb8b0):
  sale_date: 2026-04-13
  linked_attendee_id: NULL  ← não vinculada!
```

Como `contract_paid_at` é de março e a nova transação não está vinculada, o Caio:
- Não aparece nos relatórios de contrato pago de abril (SDR/Closer)
- O closer/SDR não recebe crédito pela venda de hoje
- O R2 já está agendado (14/04, status: invited) — isso está OK

### Plano de Correção

**Etapa 1: Correção manual dos dados do Caio (migração SQL)**

- Vincular a transação `fcb8b0` ao attendee R1 `9cf5a424`
- Atualizar `contract_paid_at` do attendee para `2026-04-13 16:46:47` (data real da venda nova)

```sql
-- Vincular nova transação ao attendee
UPDATE hubla_transactions 
SET linked_attendee_id = '9cf5a424-e7e3-4a96-bf16-7303f3275dc0'
WHERE id = 'fcb8b0a5-88fc-4157-9469-caeaed553b88';

-- Atualizar contract_paid_at para a data da nova venda
UPDATE meeting_slot_attendees
SET contract_paid_at = '2026-04-13 16:46:47.192+00'
WHERE id = '9cf5a424-e7e3-4a96-bf16-7303f3275dc0';
```

**Etapa 2: Nenhuma alteração no frontend necessária**

O Vinicius já está correto no banco — basta recarregar a página. O Caio aparecerá automaticamente nos relatórios de abril assim que os dados forem corrigidos.

### Resultado Esperado

- **Caio**: Contrato pago atribuído ao closer da R1 e ao SDR, visível nos relatórios de abril
- **Vinicius**: Exibido como "Novo" após refresh da página
- O R2 do Caio (14/04) permanece inalterado

