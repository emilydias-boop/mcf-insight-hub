
# Corrigir filtro de reunioes por SDR - campo `intermediador` retorna NOME, nao EMAIL

## Problema

A funcao RPC `get_sdr_meetings_from_agenda` retorna o campo `intermediador` como o **nome completo** do SDR (ex: "Juliana Rodrigues dos Santos"), mas o frontend filtra comparando `intermediador` com o **email** do SDR (ex: "juliana.rodrigues@minhacasafinanciada.com"). Como nome nunca e igual a email, a tabela de reunioes fica sempre vazia.

Exemplo do banco:
- `intermediador` = "Juliana Rodrigues dos Santos" (vem de `COALESCE(p.full_name, p.email, '')`)
- Frontend compara com `juliana.rodrigues@minhacasafinanciada.com` -- nunca bate

## Solucao

### 1. Alterar a funcao RPC (migracao SQL)

Adicionar um campo `sdr_email` na tabela de retorno da funcao, retornando `p.email` diretamente. Isso permite que o frontend filtre por email sem perder o nome para exibicao.

```sql
-- Adicionar ao RETURNS TABLE:
sdr_email text

-- No SELECT:
COALESCE(p.email, '') as sdr_email
```

### 2. Atualizar o mapeamento no frontend

**Arquivo: `src/hooks/useSdrMeetingsFromAgenda.ts`**
- Adicionar `sdr_email` na interface `AgendaMeetingRow`
- Mapear `row.sdr_email` para um novo campo ou usar como `current_owner`

**Arquivo: `src/hooks/useSdrMetricsV2.ts`**
- Verificar se `MeetingV2` precisa de um campo `sdr_email` adicional

**Arquivo: `src/hooks/useTeamMeetingsData.ts`**
- Alterar `getMeetingsForSDR` para filtrar por `m.current_owner` (email) em vez de `m.intermediador` (nome)
- Alterar `allMeetings` para usar o mesmo campo de email

### Detalhes tecnicos

A mudanca principal e:
- RPC retorna `sdr_email` (email do perfil que agendou)
- Frontend mapeia `sdr_email` para `current_owner` no `MeetingV2`
- Filtros usam `current_owner` (email) em vez de `intermediador` (nome)
- `intermediador` continua sendo o nome para exibicao na tabela

Nenhuma outra pagina e afetada pois o campo `intermediador` continua existindo com o nome para display.
