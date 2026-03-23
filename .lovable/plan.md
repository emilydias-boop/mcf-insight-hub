

## Plano: Mostrar TODAS as reuniões R1 nas Metas da Equipe (63, não 45)

### Problema

O hook `useTeamMeetingsData` filtra os resultados da RPC `get_sdr_metrics_from_agenda` para incluir apenas SDRs ativos do squad (11 pessoas). Isso descarta 18 reuniões R1 de SDRs inativos/desligados, mostrando 45 em vez de 63.

### Correção

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/useTeamMeetingsData.ts` | Remover filtro por `validSdrEmails` nos cálculos de `bySDR`, `teamKPIs`, `allMeetings` e `getMeetingsForSDR`. Manter o lookup de nomes apenas para enriquecer (usar email como fallback para SDRs não cadastrados) |

### Detalhes

1. **`bySDR`**: Remover `.filter(m => validSdrEmails.has(...))` — incluir TODOS os SDRs retornados pela RPC
2. **`teamKPIs`**: Já calcula a partir de `bySDR`, então automaticamente incluirá todos
3. **`allMeetings`**: Remover filtro por `validSdrEmails` — mostrar todas as reuniões
4. **`getMeetingsForSDR`**: Remover guard que bloqueia SDRs fora da lista
5. **`sdrNameMap`**: Manter como está (fornece nomes bonitos), mas usar `m.sdr_email.split('@')[0]` como fallback para SDRs não encontrados

### Resultado
- Metas da Equipe mostrará 63 R1 Agendadas (todas)
- Pendentes Hoje continuará mostrando 59 (pendentes, excluindo completed/no_show/contract_paid)
- Ambos os números serão corretos: 63 = total R1, 59 = ainda pendentes

