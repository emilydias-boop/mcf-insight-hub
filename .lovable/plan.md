
# Corrigir erro na RPC `get_sdr_meetings_from_agenda` - coluna `slot_id` nao existe

## Problema encontrado

A migração anterior criou a função RPC com `msa.slot_id`, mas a coluna real na tabela `meeting_slot_attendees` é `meeting_slot_id`. Isso causa o erro:

```
ERROR: 42703: column msa.slot_id does not exist
```

Por isso a RPC falha completamente e retorna 0 reuniões.

## Solução

Criar uma nova migração SQL que recria a função `get_sdr_meetings_from_agenda` corrigindo a referência de `msa.slot_id` para `msa.meeting_slot_id` no JOIN:

```sql
-- Linha incorreta:
JOIN meeting_slots ms ON ms.id = msa.slot_id

-- Linha correta:
JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
```

## Detalhes técnicos

- **Arquivo**: Nova migração SQL (DROP + CREATE da função)
- **Mudança**: Apenas 1 linha - corrigir o nome da coluna no JOIN
- **Impacto**: Nenhuma mudança no frontend necessária, apenas a correção do SQL
- Todo o resto da função (campos retornados, filtros, lógica) permanece igual
