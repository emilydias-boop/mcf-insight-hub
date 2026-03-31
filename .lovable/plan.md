

## Substituir "Ligações" por "Novos Leads" no Funil Individual do SDR

### O que muda

O primeiro passo do funil passará de **Ligações → Contatos** para **Novos Leads → R1 Agendada → R1 Realizada → Contratos**. "Novos Leads" = deals criados no período cujo `owner_id` é o email do SDR, sem histórico anterior de movimentação de estágio (i.e., entrada genuína na pipeline).

### Implementação

**1. Criar query para contar novos leads do SDR** — Novo hook ou query inline em `useSdrPerformanceData.ts`:
- Buscar `crm_deals` onde `owner_id = sdrEmail`, `created_at` dentro do período
- Para cada deal, verificar se NÃO existe `deal_activities` com `activity_type = 'stage_change'` anterior à `created_at` do deal (garantindo que é entrada nova, sem histórico prévio)
- Alternativa mais simples: contar deals onde `created_at` está no período e o deal só tem 0-1 registros em `deal_activities` (a entrada inicial), o que indica lead novo

**2. Atualizar o funil** em `useSdrPerformanceData.ts` (linhas 345-360):
- Trocar `{ label: "Ligações", value: callMetrics.totalCalls }` por `{ label: "Novos Leads", value: novosLeads }`
- Remover `{ label: "Contatos", value: callMetrics.answered }` (não faz mais sentido no funil sem ligações)
- Funil final: **Novos Leads → R1 Agendada → R1 Realizada → Contratos**

**3. Atualizar KPI "Total Ligações"** — Manter o KPI card de ligações separado (não está no funil), mas o funil não usará mais esses dados.

### Arquivos afetados
- `src/hooks/useSdrPerformanceData.ts` — Nova query de novos leads + atualizar array `funnel`
- Possivelmente nova query via `useQuery` para buscar count de deals novos do SDR no período

### Abordagem para "sem histórico anterior"
A forma mais eficiente: contar `crm_deals` com `owner_id = sdrEmail` e `created_at` no período. Deals que entram na pipeline pela primeira vez são automaticamente "novos" — a `created_at` do deal é a data de entrada. Não precisamos verificar `deal_activities` pois a criação do deal já representa a entrada do lead.

