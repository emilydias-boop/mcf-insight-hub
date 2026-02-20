
# Corrigir coluna `slot_id` para `meeting_slot_id` na RPC

## Problema confirmado

A funcao `get_sdr_meetings_from_agenda` no banco de dados ainda usa `msa.slot_id`, mas a coluna real na tabela `meeting_slot_attendees` se chama `meeting_slot_id`. Isso causa o erro:

```
ERROR: 42703: column msa.slot_id does not exist
```

A migracao de correcao anterior nao foi aplicada, entao a funcao continua quebrada.

## Solucao

Aplicar uma migracao SQL que recria a funcao corrigindo apenas o nome da coluna no JOIN:

```sql
-- De (incorreto):
JOIN meeting_slots ms ON ms.id = msa.slot_id

-- Para (correto):
JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
```

## Detalhes tecnicos

- **Escopo**: Apenas 1 linha de SQL precisa mudar dentro da funcao
- **Migracao**: DROP da funcao existente + CREATE com a coluna corrigida
- **Frontend**: Nenhuma mudanca necessaria - o mapeamento ja esta correto desde a alteracao anterior
- **Impacto**: Apenas a funcao `get_sdr_meetings_from_agenda` - nenhuma outra funcao e afetada
