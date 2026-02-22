

# Correcao: Funcao get_sdr_meetings_from_agenda referencia coluna inexistente

## O que esta acontecendo

A funcao do banco `get_sdr_meetings_from_agenda` esta usando `msa.slot_id` para fazer o JOIN com `meeting_slots`, mas a coluna correta na tabela `meeting_slot_attendees` se chama `meeting_slot_id`. Isso causa o erro **"column msa.slot_id does not exist"** e impede qualquer dado de carregar na agenda -- nao e um problema de permissao.

## O que precisa ser feito

Uma unica alteracao na funcao do banco de dados: trocar `msa.slot_id` por `msa.meeting_slot_id` no JOIN.

Nenhum codigo frontend precisa ser alterado.

## Detalhes tecnicos

Recriar a funcao corrigindo a linha do JOIN:

```text
-- Linha atual (incorreta):
JOIN meeting_slots ms ON ms.id = msa.slot_id

-- Correcao:
JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
```

A funcao completa sera recriada com `CREATE OR REPLACE FUNCTION` mantendo toda a logica existente, apenas corrigindo essa referencia.

## Resultado esperado

- A agenda R1 carrega normalmente para todos os usuarios, incluindo admins
- Todos os dados de reunioes voltam a aparecer

