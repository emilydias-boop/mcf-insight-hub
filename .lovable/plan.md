

## Problema

A query em `deal_activities` retorna apenas **15 registros** de "Reunião 01 Agendada" em fevereiro. A fonte correta é o sistema de agenda (`meeting_slot_attendees` + `meeting_slots`), que tem **~866** registros — a mesma fonte usada pelas Metas da Equipe.

A tabela `deal_activities` não é a fonte de verdade para reuniões agendadas — é apenas um log parcial de mudanças de stage no CRM.

## Solução

Trocar as queries de **Reuniões Agendadas** e **Contratos Pagos** no `FunilDashboard.tsx` para usar a mesma RPC do painel de Metas: `get_sdr_metrics_from_agenda`.

### Alteração em `src/components/crm/FunilDashboard.tsx`

**KPIs do período atual (linhas ~98-133):**
1. Manter a query de `novosLeads` (crm_deals) como está
2. Substituir as 2 queries de `deal_activities` por uma chamada à RPC `get_sdr_metrics_from_agenda`
3. Extrair `r1_agendada` (sum) para Reuniões Agendadas e `contratos` (sum) para Contratos Pagos
4. Recalcular Taxa de Conversão com os novos valores

**KPIs do período anterior (linhas ~135-170):**
- Mesma mudança: usar `get_sdr_metrics_from_agenda` com datas do período anterior

```typescript
// Exemplo da nova lógica:
const [
  { count: novosLeads },
  rpcResult,
] = await Promise.all([
  supabase.from('crm_deals')
    .select('*', { count: 'exact', head: true })
    .eq('origin_id', PIPELINE_ORIGIN_ID)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString()),
  supabase.rpc('get_sdr_metrics_from_agenda', {
    start_date: format(periodStart, 'yyyy-MM-dd'),
    end_date: format(periodEnd, 'yyyy-MM-dd'),
    sdr_email_filter: null,
  }),
]);

const rpcData = (rpcResult.data as any)?.metrics || [];
const agendadasCount = rpcData.reduce((sum, m) => sum + (m.r1_agendada || 0), 0);
const contratosCount = rpcData.reduce((sum, m) => sum + (m.contratos || 0), 0);
```

Isso alinha o Painel de Controle do Funil com o Painel de Metas da Equipe (866 R1 Agendada, ~209 Contratos).

