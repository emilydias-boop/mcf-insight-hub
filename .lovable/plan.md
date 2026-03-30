

## Corrigir RPC ambígua que impede carga de métricas no fechamento

### Causa raiz

O erro nos logs é claro:

```text
PGRST203: Could not choose the best candidate function between:
  public.get_sdr_metrics_from_agenda(start_date, end_date, sdr_email_filter)
  public.get_sdr_metrics_from_agenda(start_date, end_date, sdr_email_filter, bu_filter)
```

Existem **duas versões** da função `get_sdr_metrics_from_agenda` no banco — uma com 3 parâmetros e outra com 4. Quando o `useSdrAgendaMetricsBySdrId` chama a RPC sem `bu_filter`, o PostgREST não consegue escolher qual usar e retorna erro. Isso faz:

1. **KPI Edit Form**: mostra "Agenda: 0" para todos os SDRs
2. **Edge Function**: também pode ser afetada (embora use `supabase-js` server-side que tem comportamento diferente)
3. **Indicador cards**: mostram valores antigos do KPI persistido, que não é atualizado porque o RPC falha

### Solução

Passar `bu_filter: null` explicitamente em todas as chamadas que não enviam esse parâmetro, para que o PostgREST resolva a ambiguidade.

#### Arquivo 1: `src/hooks/useSdrAgendaMetricsBySdrId.ts`
- Linha 42-46: Adicionar `bu_filter: null` na chamada RPC

#### Arquivo 2: `supabase/functions/recalculate-sdr-payout/index.ts`
- Linha 598-602: Adicionar `bu_filter: null` na chamada RPC (mesmo padrão)

### Resultado
Todas as chamadas à RPC resolvem corretamente para a versão de 4 parâmetros. Os KPIs são preenchidos com dados reais da agenda, e o "Recalcular Todos" salva os valores corretos no banco.

### Arquivos alterados
1. `src/hooks/useSdrAgendaMetricsBySdrId.ts`
2. `supabase/functions/recalculate-sdr-payout/index.ts`

