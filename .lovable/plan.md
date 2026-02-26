

## Problema identificado: Evolução Diária vazia no SDR

### Causa raiz
A RPC `get_sdr_meetings_from_agenda` retorna status em inglês: `completed`, `no_show`, `contract_paid`, `invited`, `rescheduled`.

O `useSdrMeetingsFromAgenda.ts` (linha 78) repassa esse valor sem tradução: `status_atual: row.status_atual`.

Mas o `SdrMeetingsChart.tsx` (linhas 48-55) verifica strings em português:
- `status.includes('agendada')` — nunca match com `invited`/`rescheduled`
- `status.includes('realizada')` — nunca match com `completed`
- `status.includes('no-show')` — nunca match com `no_show`

### Correção

**Arquivo: `src/components/sdr/SdrMeetingsChart.tsx`** (linhas 47-55)

Atualizar a classificação para reconhecer ambos os formatos (português e inglês):

```typescript
const status = meeting.status_atual?.toLowerCase() || '';

if (status.includes('agendada') || status === 'invited' || status === 'rescheduled') {
  entry.agendadas++;
} else if (status.includes('realizada') || status === 'completed') {
  entry.realizadas++;
} else if (status.includes('no-show') || status.includes('noshow') || status === 'no_show') {
  entry.noShow++;
} else if (status.includes('contrato') || status === 'contract_paid') {
  entry.realizadas++; // contrato pago também conta como realizada no gráfico
}
```

Isso é uma correção de 1 linha lógica — apenas expandir os if/else para aceitar os valores ingleses retornados pela RPC.

