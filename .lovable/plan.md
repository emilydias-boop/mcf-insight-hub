## Contexto

Contato: **Josias Rabelo Junior** (joraju2004@yahoo.com.br)
Deal: `b02b91c7-3dd4-4f9a-9662-a9500f74fb65` — A010 Consultoria, pipeline Inside Sales, `original_sdr_email = mayara.souza@minhacasafinanciada.com` (já está correto no deal).

Há **dois attendees** R1 ligados a esse deal:

| Data | Status | booked_by (SDR) | contract_paid_at |
|---|---|---|---|
| 29/04/2026 17:15 | `no_show` | Mayara ✅ | — |
| 06/05/2026 06:06 | `contract_paid` | **NULL** ❌ | 06/05 06:06 |

O contrato pago foi registrado num R1 "Outside Lead" (criado automaticamente sem booked_by). Por isso, na aba "Minhas Reuniões / Contratos" da Mayara o contrato não aparece — a atribuição de SDR para fins de fechamento usa `booked_by` no attendee de R1 vinculado ao `contract_paid_at`, conforme regra **SDR Attribution Hierarchy** (`booked_by > pipeline owner > general owner`).

## O que precisa mudar

Atualizar **somente** o attendee `3d70438d-365e-4a48-9f40-95a2a6c74e8b` (R1 de 06/05, contract_paid):

```sql
UPDATE meeting_slot_attendees
SET booked_by = '39162395-dec0-40b2-94ed-3a7443013e44'  -- Mayara Souza
WHERE id = '3d70438d-365e-4a48-9f40-95a2a6c74e8b';
```

Isso faz com que:
- A SDR Mayara apareça como **intermediadora** desse R1.
- O contrato seja contabilizado para ela em fechamento, KPIs de equipe e listagem de contratos do SDR (`useSdrContractsFromAgenda`).
- O `original_sdr_email` do deal já é Mayara, então não precisa mexer no `crm_deals`.
- Não toca no R1 de 29/04 (que já está OK como no-show da Mayara).

## Passos

1. Criar migration `supabase/migrations/<timestamp>_attribute_josias_contract_to_mayara.sql` com o UPDATE acima.
2. Validar pós-migration:
   - `meeting_slot_attendees.booked_by` do attendee 06/05 = profile da Mayara.
   - Reabrir a tela do SDR Mayara → seção Contratos do mês 2026-05 deve listar "Josias Rabelo Junior".

## Riscos

- Operação pontual num único registro, sem efeito em comissão de Closer (continua atribuído ao closer atual `0d4a5264...`) nem em deduplicação. Reversível com UPDATE inverso (`booked_by = NULL`).
