

## Problema Identificado

Na página "Reuniões Equipe" do Incorporador, a tabela de SDRs mostra **todos** os SDRs que agendaram reuniões com closers da BU `incorporador`, independente de pertencerem ou não ao squad `incorporador`. Isso acontece por dois motivos:

1. **Filtro de squad nunca aplicado nos resultados**: O hook `useTeamMeetingsData` computa `validSdrEmails` (emails dos SDRs do squad via `useSdrsFromSquad`), mas **nunca usa esse Set para filtrar** o array `bySDR`. O comentário na linha 61 diz "FILTERED to only include the 13 SDRs from SDR_LIST" mas o `.filter()` foi removido — todos os SDRs retornados pela RPC aparecem.

2. **`ReunioesEquipe.tsx` não passa `squad`**: As 4 chamadas a `useTeamMeetingsData` na página não passam `squad`, então o default `'incorporador'` é usado para a RPC (filtra closers), mas sem o filtro de SDR no frontend, SDRs de outras BUs que agendaram com closers incorporador aparecem na tabela.

---

## Plano de Correção

### Arquivo: `src/hooks/useTeamMeetingsData.ts`

Adicionar filtro por `validSdrEmails` no `bySDR` memo (linha 65). Onde hoje faz apenas `.map().sort()`, adicionar um `.filter()` antes:

```typescript
// linha 65 — adicionar filtro ANTES do .map()
return metrics
  .filter((m: SdrAgendaMetrics) => {
    // Se temos SDRs válidos do squad, filtrar apenas eles
    if (validSdrEmails.size > 0) {
      return validSdrEmails.has(m.sdr_email?.toLowerCase() || '');
    }
    return true; // fallback se não carregou SDRs ainda
  })
  .map((m: SdrAgendaMetrics) => { ... })
  .sort((a, b) => b.agendamentos - a.agendamentos);
```

Adicionar `validSdrEmails` às dependências do `useMemo`.

### Resultado Esperado

Apenas SDRs cadastrados na tabela `sdr` com `squad = 'incorporador'`, `active = true`, `role_type = 'sdr'`, e que não estejam bloqueados ou com cargo administrativo, aparecerão na tabela — exatamente o mesmo filtro que já é usado no Painel Equipe do Consórcio.

