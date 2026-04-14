

## Plano: Usar "Agendamento" (booked_at) em vez de "R1 Agendada" (scheduled_at)

### Problema

O relatório conta R1 por `scheduled_at` (data da reunião) = 247, mas o dashboard mostra **Agendamento** por `booked_at` (data que o SDR criou) = 293. São métricas diferentes:

| Métrica | Base | Valor | Significado |
|---------|------|-------|-------------|
| **Agendamento** | `booked_at` / `created_at` | 293 | Quantas reuniões o SDR criou no período |
| **R1 Agendada** | `scheduled_at` | 247 | Quantas reuniões estão marcadas PARA o período |

O relatório do gestor deve mostrar **Agendamento = 293** (produção dos SDRs), não R1 Agendada.

No-shows também divergem: o dashboard calcula `no_shows = r1_agendada - r1_realizada` = 94, enquanto a edge function conta status `no_show` diretamente (85).

### Correção em `supabase/functions/weekly-manager-report/index.ts`

**1. Chamar a RPC `get_sdr_metrics_from_agenda` diretamente**

Em vez de fazer query manual na `meeting_slot_attendees`, chamar a mesma RPC que o dashboard usa:

```ts
const { data: sdrMetrics } = await supabase.rpc('get_sdr_metrics_from_agenda', {
  start_date: fmtDate(labels.carrinhoStart),  // '2026-04-04'
  end_date: fmtDate(labels.carrinhoEnd),       // '2026-04-10'
  sdr_email_filter: null,
  bu_filter: 'incorporador'
});
```

**2. Agregar os totais da RPC**

Somar `agendamentos`, `r1_agendada`, `r1_realizada`, `no_shows` e `contratos` de todos os SDRs retornados (filtrando pelos SDRs do squad incorporador, como o dashboard faz via `useSdrsFromSquad`).

**3. Usar os valores corretos no HTML**

- "Agendamentos" = soma de `agendamentos` (293)
- "R1 Realizadas" = soma de `r1_realizada` (153)
- "No-Shows" = soma de `no_shows` (94, calculado como `r1_agendada - r1_realizada` pela RPC)
- Manter "R1 Agendada" como métrica secundária se desejado (247)

**4. Filtrar por SDRs do squad incorporador**

Buscar emails dos SDRs via `squads` + `profiles` (mesma lógica de `useSdrsFromSquad`) e filtrar os resultados da RPC para incluir apenas esses SDRs.

### Resultado esperado

- Agendamentos: **293** (igual ao dashboard)
- R1 Realizada: **153**
- No-Shows: **94**
- Contratos: **54**

