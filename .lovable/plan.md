

## Corrigir Lead "Luiz Guilherme" no Consórcio — Reverter contract_paid

### Dados identificados

| Campo | Valor |
|---|---|
| Attendee ID | `801a0bf4-18ad-4f3a-9023-deda067413c7` |
| Deal ID | `99174ab6-0406-403c-bb4c-e4455db70381` (Efeito Alavanca + Clube / Consórcio) |
| Hubla Transaction | `75be8224-c2a2-4c53-8b70-127d8ab68079` |
| Stage atual do deal | R1 Agendada (já correto, não precisa reverter) |

### Ações (2 UPDATEs via insert tool)

**1. Reverter status do attendee**
```sql
UPDATE meeting_slot_attendees 
SET status = 'completed', contract_paid_at = NULL 
WHERE id = '801a0bf4-18ad-4f3a-9023-deda067413c7';
```

**2. Desvincular a transação Hubla**
```sql
UPDATE hubla_transactions 
SET linked_attendee_id = NULL 
WHERE id = '75be8224-c2a2-4c53-8b70-127d8ab68079';
```

Após essas correções, o lead voltará a aparecer como "Realizada" na agenda do Consórcio, sem a marcação incorreta de contrato pago.

