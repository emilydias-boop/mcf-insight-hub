

# Corrigir erro de tipo na funcao `get_sdr_meetings_from_agenda`

## Problema

A funcao RPC `get_sdr_meetings_from_agenda` recebe `start_date` e `end_date` como `TEXT`, mas compara diretamente com uma coluna `DATE` sem fazer cast:

```sql
WHERE COALESCE(msa.booked_at, msa.created_at)::DATE BETWEEN start_date AND end_date
```

Isso gera o erro: `operator does not exist: date >= text`.

## Solucao

Criar uma migracao SQL que recria a funcao adicionando `::DATE` nos parametros text:

```sql
CREATE OR REPLACE FUNCTION public.get_sdr_meetings_from_agenda(
  start_date text, end_date text, sdr_email_filter text DEFAULT NULL
)
RETURNS TABLE(...) -- mesma assinatura
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  WHERE COALESCE(msa.booked_at, msa.created_at)::DATE 
        BETWEEN start_date::DATE AND end_date::DATE
    AND msa.status != 'cancelled'
    AND msa.is_partner = false
    AND (sdr_email_filter IS NULL OR p.email = sdr_email_filter)
  ORDER BY COALESCE(msa.booked_at, msa.created_at) DESC;
END;
$$;
```

A unica mudanca e `start_date::DATE` e `end_date::DATE` na clausula `BETWEEN`.

## Nenhuma alteracao de codigo frontend necessaria

O hook `useSdrMeetingsFromAgenda.ts` ja envia os parametros como strings no formato `yyyy-MM-dd`, que e compativel com o cast para `DATE`.

## Resultado esperado

- A tabela de reunioes na pagina "Minhas Reunioes" passa a exibir os leads agendados pelos SDRs
- Sem impacto nos KPIs (usam RPC separada `get_sdr_metrics_from_agenda`)

