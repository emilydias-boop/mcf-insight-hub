

User quer só alinhar o email com o painel atual. Sem toggle, sem mexer no painel.

## Alinhar email Incorporador com painel

Mudar `weekly-manager-report/index.ts` (`buildIncorporadorReport`):

1. **Fórmulas R1** — usar mesma base do painel:
   - `% No-Show` = `noShows / r1Agendada` (não mais `/ (realizada + noShows)`)
   - `% Comparecimento` = `realizada / r1Agendada`

2. **Label** — renomear KPI "Agendamentos" para **"R1 Agendada"** com legenda curta: *"Reuniões marcadas PARA esta semana (Sáb–Sex). Mesma métrica do painel /crm/reunioes-equipe."*

3. **Manter** KPI "Outros" (reagendadas/canceladas/pendentes) que já fecha a equação.

Resultado: email passa a mostrar exatamente os mesmos % do painel no mesmo período. Toggle "criadas vs para o período" fica para depois.

**Arquivo único**: `supabase/functions/weekly-manager-report/index.ts`. Sem mudança em painel, sem DB, sem novos arquivos.

