

# Correção: Colunas Inexistentes na RPC

## Problema Identificado

A função `get_sdr_metrics_from_agenda` usa colunas que **não existem**:

| Coluna Errada | Tabela | Coluna Correta |
|---------------|--------|----------------|
| `msa.sdr_id` | `meeting_slot_attendees` | `msa.booked_by` |
| `p.nome`, `p.name` | `profiles` | `p.full_name` |
| `p.role` | `profiles` | Deve usar JOIN com `user_roles.role` |

## Estrutura Real das Tabelas

```text
meeting_slot_attendees:
├── id, meeting_slot_id, contact_id, deal_id
├── booked_by (uuid) --> profiles.id  ← SDR que agendou
├── booked_at, status, is_reschedule
└── contract_paid_at

profiles:
├── id, email
├── full_name  ← Nome correto
└── (sem coluna role)

user_roles:
├── user_id --> profiles.id
└── role (sdr, closer, admin, etc.)
```

## Correção SQL

| Local | Antes | Depois |
|-------|-------|--------|
| JOIN principal | `msa.sdr_id = p.id` | `msa.booked_by = p.id` |
| Nome do SDR | `p.nome, p.name` | `p.full_name` |
| Filtro de role | `p.role IN (...)` | `JOIN user_roles ur ON ur.user_id = p.id WHERE ur.role IN (...)` |

## Migration a Criar

Nova migration SQL que:

1. **DROP** a função existente
2. **CREATE** nova versão com:
   - `msa.booked_by` para identificar o SDR
   - `p.full_name` para nome
   - JOIN com `user_roles` para filtrar por role
   - Mantém lógica de No-Show: `GREATEST(0, agendamentos - r1_realizada)`

## Resultado Esperado

Após a correção:
- Carol Correa: 181 Agendamentos, 124 R1 Realizada, 57 No-Show
- Lista de SDRs aparece corretamente no Painel Comercial

