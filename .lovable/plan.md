

# Corrigir erro PGRST203 — função duplicada `get_sdr_meetings_from_agenda`

## Problema

A tabela de reuniões na página "Minhas Reuniões" aparece vazia ("Nenhuma reunião encontrada") apesar dos KPIs mostrarem 69 agendamentos. O erro nos logs do console e:

```
PGRST203: Could not choose the best candidate function between:
  public.get_sdr_meetings_from_agenda(start_date => date, ...)
  public.get_sdr_meetings_from_agenda(start_date => text, ...)
```

Existem **duas versoes** da mesma funcao RPC no banco de dados, e o PostgREST nao consegue resolver qual chamar.

## Causa raiz

Alguem criou uma segunda versao da funcao com parametros `date` em vez de `text`. Como o PostgREST envia os parametros sem tipo explicito, ele nao consegue desambiguar entre as duas.

## Solucao

Remover a versao duplicada com parametros `date`, mantendo apenas a versao `text` que o codigo frontend ja utiliza.

### SQL a executar no Supabase SQL Editor:

```sql
DROP FUNCTION IF EXISTS public.get_sdr_meetings_from_agenda(date, date, text);
```

Isso remove apenas a overload `(date, date, text)`, preservando a versao `(text, text, text)` que e a utilizada pelo hook `useSdrMeetingsFromAgenda.ts`.

## Nenhuma alteracao de codigo necessaria

O frontend (`useSdrMeetingsFromAgenda.ts`) ja envia os parametros como `text` usando `format(startDate, "yyyy-MM-dd")`, entao nenhuma modificacao de arquivo e necessaria. Basta remover a funcao duplicada no banco.

## Resultado esperado

- A RPC `get_sdr_meetings_from_agenda` volta a funcionar sem ambiguidade
- A tabela de reunioes na pagina "Minhas Reunioes" passa a exibir os leads agendados pelos SDRs
- Os KPIs no topo continuam funcionando normalmente (usam outra RPC: `get_sdr_metrics_from_agenda`)

