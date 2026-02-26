

## Problema: No-Show e Tentativas não auto-preenchem quando já existe KPI salvo

### Causa raiz
No `KpiEditForm.tsx`, o auto-preenchimento da Agenda e Twilio (linhas 93-111) só acontece quando **não existe KPI salvo** (`!kpi`). Quando o KPI já foi salvo uma vez, o formulário carrega os valores antigos do banco (linhas 80-90) e nunca mais atualiza automaticamente.

Resultado: Agendamentos e Realizadas parecem corretos porque foram salvos com valores recentes, mas No-Shows (19 no banco vs 22 da Agenda) e Tentativas (0 no banco vs 750 do Twilio) ficam desatualizados.

### Correção
No `KpiEditForm.tsx`, **sempre** sobrescrever `no_shows` e `tentativas_ligacoes` com os valores automáticos (Agenda/Twilio) quando eles estiverem disponíveis — independente de já existir KPI salvo. Manter a possibilidade de edição manual pelo coordenador.

Concretamente:
- Remover a condição `!kpi` dos useEffects de auto-preenchimento (linhas 93-111)
- Os 3 campos automáticos (agendamentos, realizadas, no_shows) sempre atualizam da Agenda
- Tentativas sempre atualiza do Twilio (para SDRs)
- Score de organização continua manual (nunca auto-preenchido)

### Arquivo alterado
`src/components/sdr-fechamento/KpiEditForm.tsx` — remover `!kpi &&` das condições de auto-fill

