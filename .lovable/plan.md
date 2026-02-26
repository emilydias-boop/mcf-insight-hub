

## Problema: "Agendadas" não aparece no gráfico

### Causa raiz
O gráfico classifica reuniões pelo **status atual** — mas quase todas já progrediram para `completed`, `no_show` ou `contract_paid`. Apenas 89 de ~1960 reuniões ainda estão em `invited`. Por isso a barra "Agendadas" fica quase vazia.

Além disso, o status `scheduled` (4 registros) não estava sendo reconhecido.

### Correção em `src/components/sdr/SdrMeetingsChart.tsx`

Mudar a lógica: **todas as reuniões do dia contam como "Agendadas"**. "Realizadas" e "No-Show" são subconjuntos adicionais. Assim o gráfico mostra o volume total agendado vs. o que foi realizado vs. no-show.

```typescript
if (dayMap.has(key)) {
  const entry = dayMap.get(key)!;
  
  // Toda reunião conta como agendada
  entry.agendadas++;
  
  // Adicionalmente classificar o resultado
  const status = meeting.status_atual?.toLowerCase() || '';
  if (status.includes('realizada') || status === 'completed' || status === 'contract_paid' || status.includes('contrato')) {
    entry.realizadas++;
  } else if (status.includes('no-show') || status.includes('noshow') || status === 'no_show') {
    entry.noShow++;
  }
}
```

Resultado: "Agendadas" = total de reuniões por dia, "Realizadas" e "No-Show" mostram os resultados.

