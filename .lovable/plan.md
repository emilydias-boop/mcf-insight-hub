

## Ajuste: Leticia trocou de squad — atribuir contrato ao squad ativo na data do agendamento

### Contexto

Leticia Nunes está hoje no squad **crédito**, mas quando agendou a reunião do Natanael (que virou contrato Incorporador em 22/04) ela estava no squad **incorporador**. Por isso o contrato dela deve aparecer normalmente na aba SDRs do Incorporador para o período de 22/04, e só sair quando consultarmos períodos posteriores à troca de squad.

### Regra correta

Atribuir o agendamento/contrato ao SDR considerando o **squad que ele tinha na data em que agendou** (`meeting_slot_attendees.created_at`), não o squad atual.

| Cenário | Squad em 22/04 | Squad hoje | Aparece em SDRs Incorporador (período 22/04)? |
|---|---|---|---|
| Leticia agendou Natanael em 22/04 | incorporador | crédito | ✅ Sim |
| Leticia agenda novo lead hoje | crédito | crédito | ❌ Não (vai para aba Crédito) |

### Mudanças

**1. Histórico de squad por SDR**

Verificar se já existe tabela de histórico (`sdr_squad_history` / `employees_history` / coluna `squad_changed_at`). Se não existir, criar:

```sql
create table public.sdr_squad_history (
  id uuid primary key default gen_random_uuid(),
  sdr_id uuid references public.sdr(id) on delete cascade,
  squad text not null,
  valid_from timestamptz not null,
  valid_to timestamptz,
  created_at timestamptz default now()
);
```

Backfill: para cada SDR, criar uma linha com `valid_from = sdr.created_at` e `squad = sdr.squad` atual. Trigger no `UPDATE` da `public.sdr` quando `squad` muda: fechar a linha aberta (`valid_to = now()`) e inserir nova linha.

**2. RPC `get_sdr_metrics_from_agenda`**

Trocar o filtro `WHERE sdr.squad = bu_filter` por:
```sql
join sdr_squad_history h
  on h.sdr_id = sdr.id
 and h.squad = bu_filter
 and msa.created_at >= h.valid_from
 and msa.created_at <  coalesce(h.valid_to, 'infinity')
```
Assim o SDR é incluído se pertencia ao squad da BU **na data em que agendou** o attendee.

**3. Frontend `useTeamMeetingsData.ts`**

Hoje o filtro `validSdrEmails` vem de `useSdrsFromSquad('incorporador')`, que é a foto **atual**. Mudar para um novo hook `useSdrsForSquadInPeriod(squad, startDate, endDate)` que consulta `sdr_squad_history` e retorna todos os SDRs que estiveram no squad em qualquer momento dentro do período. Leticia entra na lista se o intervalo `[valid_from, valid_to)` cruza `[startDate, endDate]`.

**4. UI — `SdrSummaryTable.tsx`**

Para SDRs que não estão mais no squad (mas estavam no período), exibir badge cinza `"ex-{squad}"` ao lado do nome para deixar claro. Sem alterar lógica de meta — meta usa `sdr_squad_history` igualmente para calcular dias úteis no squad.

**5. Plano anterior continua valendo**

- Cards do topo sempre usam `enrichedKPIs` (já consolidado).
- Linha "Total" da tabela SDRs usa `totaisOverride` derivado de `enrichedKPIs`.

### Arquivos afetados

- **Migration**: criar `sdr_squad_history`, trigger e backfill.
- `supabase/migrations/...` — nova migration.
- `supabase/functions/...` ou RPC `get_sdr_metrics_from_agenda` — usar histórico.
- `src/hooks/useSdrsFromSquad.ts` — adicionar variante por período (ou novo hook `useSdrsForSquadInPeriod`).
- `src/hooks/useTeamMeetingsData.ts` — usar lista por período.
- `src/components/sdr/SdrSummaryTable.tsx` — badge "ex-squad" + `totaisOverride`.
- `src/pages/crm/ReunioesEquipe.tsx` — passar `enrichedKPIs` sempre nos cards.

### Validação

1. Período 22/04, BU Incorporador: Leticia aparece com 1 contrato (Natanael) e badge `"ex-incorporador"`. Total = 8.
2. Período hoje (23/04+), BU Incorporador: Leticia **não** aparece, novos agendamentos dela vão para Crédito.
3. Período hoje, BU Crédito: Leticia aparece normalmente.
4. SDR que nunca trocou de squad: comportamento idêntico ao atual.

### Pergunta antes de implementar

A tabela `sdr` tem hoje algum campo tipo `squad_changed_at` ou histórico em outro lugar (ex: `employees_history`, log de auditoria)? Se sim, reaproveito; se não, crio a `sdr_squad_history` do zero com backfill conservador (assume squad atual desde `sdr.created_at`).

