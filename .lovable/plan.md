

# Fix: SDRs nao veem lista de leads em "Minhas Reunioes"

## Causa Raiz

A RPC `get_sdr_meetings_from_agenda` tem um erro de nome de coluna. Ela referencia `msa.is_rescheduled` mas a coluna real na tabela `meeting_slot_attendees` se chama `is_reschedule`.

Isso causa um erro 400 em toda chamada, e a lista de reunioes volta vazia.

## Correcao

Alterar a funcao SQL no Supabase para usar o nome correto da coluna: `is_reschedule` ao inves de `is_rescheduled`.

### Passo unico: SQL Migration

Executar um `ALTER FUNCTION` ou `CREATE OR REPLACE FUNCTION` para corrigir a referencia de `msa.is_rescheduled` para `msa.is_reschedule` na funcao `get_sdr_meetings_from_agenda`.

Como nao temos o corpo completo da funcao nos arquivos do projeto, sera necessario:

1. Consultar a definicao atual da funcao no banco
2. Substituir `msa.is_rescheduled` por `msa.is_reschedule`
3. Recriar a funcao com a correcao

### Impacto

- Todas as paginas que usam `useSdrMeetingsFromAgenda` voltarao a funcionar (Minhas Reunioes, detalhe do SDR)
- Nenhuma mudanca no frontend necessaria -- o problema e exclusivamente no banco de dados

