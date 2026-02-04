
# Plano: Corrigir Datas de Pagamento Históricas

## Problema Identificado

3 attendees estão com `contract_paid_at` usando a **data da reunião** em vez da **data do pagamento**:

| Cliente | Data Atual | Data Correta (Hubla) |
|---------|-----------|---------------------|
| André | 03/02 19:00 | 04/02 21:19 |
| Israel Anijar | 03/02 17:00 | 04/02 19:30 |
| Henrique | NULL | 04/02 14:25 |

Isso causa a discrepância: **9 contratos na agenda vs 11 na Hubla** para hoje.

---

## Solução: Script SQL de Correção

Preciso criar uma edge function temporária que execute o UPDATE, ou você pode executar este SQL manualmente no Cloud View > Run SQL:

```sql
-- Corrigir André (follow-up de 03/02, pagou em 04/02)
UPDATE meeting_slot_attendees 
SET contract_paid_at = '2026-02-04 21:19:04.276+00'
WHERE id = 'f7d60a7c-a539-4bed-8bf1-d037196f2735';

-- Corrigir Israel Anijar (follow-up de 03/02, pagou em 04/02)
UPDATE meeting_slot_attendees 
SET contract_paid_at = '2026-02-04 19:30:01.849+00'
WHERE id = '20e9767d-3557-43c3-8f7f-c3ea96b75fce';

-- Corrigir Henrique (contract_paid_at era NULL)
UPDATE meeting_slot_attendees 
SET contract_paid_at = '2026-02-04 14:25:20.262+00'
WHERE id = '3543e422-d87c-4c63-b4fa-13c933f21597';
```

---

## Ação Recomendada

1. **Execute o SQL acima** no Supabase Dashboard > SQL Editor
2. Após executar, a agenda mostrará **11 contratos** para 04/02 (em vez de 9)

---

## Sobre os 2 Contratos Restantes (Lucas e Eduardo)

Esses clientes compraram com **emails diferentes** na Hubla vs agenda:
- Lucas Chaves: `lucas_chaves1994@outlook.com` (Hubla) vs `lucas_nchaves@icloud.com` (agenda)
- Eduardo Henrique: `edeoliveiraimoveis@gmail.com` (não encontrado na agenda)

Esses precisam de vinculação manual ou o webhook precisa melhorar o match por telefone/nome.

---

## Resumo

- **3 registros** corrigidos com data real do pagamento
- **2 registros** pendentes (emails divergentes)
- **Webhook já corrigido** para futuros pagamentos usarem `data.saleDate`
