

## Ajustar ordem de exibição dos estágios na tabela

Reordenar as linhas da tabela de "Movimentações de Estágio" para seguir exatamente a sequência operacional do funil, intercalando estágios principais e laterais na ordem que faz sentido para o time.

### Ordem desejada

1. ANAMNESE INCOMPLETA
2. LEAD GRATUITO
3. NOVO LEAD
4. LEAD INSTAGRAM
5. LEAD QUALIFICADO
6. SEM INTERESSE
7. R1 AGENDADA
8. NO-SHOW
9. R1 REALIZADA
10. CONTRATO PAGO
11. R2 AGENDADA
12. NO-SHOW R2
13. R2 REALIZADA
14. VENDAS FINAIS

### Mudança no código

**Arquivo único:** `src/hooks/useStageMovements.ts`

Adicionar uma constante `STAGE_DISPLAY_ORDER` com a ordem fixa por `stageNameKey` (chave canônica já normalizada via `STAGE_ALIASES`):

```ts
const STAGE_DISPLAY_ORDER: string[] = [
  'anamnese incompleta',
  'lead gratuito',
  'novo lead',
  'lead instagram',
  'lead qualificado',
  'sem interesse',
  'r1 agendada',
  'no-show',
  'r1 realizada',
  'contrato pago',
  'r2 agendada',
  'no-show r2',
  'r2 realizada',
  'venda realizada',
];
```

No final da agregação do `summaryRows`, substituir o sort atual (que usa `stage_order` da pipeline) por:

```ts
summaryRows.sort((a, b) => {
  const ia = STAGE_DISPLAY_ORDER.indexOf(a.stageNameKey);
  const ib = STAGE_DISPLAY_ORDER.indexOf(b.stageNameKey);
  // Estágios não mapeados vão para o final, mantendo ordem alfabética entre si
  if (ia === -1 && ib === -1) return a.stageName.localeCompare(b.stageName);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
});
```

### Garantias

- Estágios fora da lista (qualquer custom de outra pipeline) caem no final, ordenados alfabeticamente — sem quebrar
- Aliases já normalizam variações ("REUNIÃO 1 AGENDADA" → "r1 agendada"), então a ordem se aplica cross-pipeline
- Zero mudança em UI, totais, inferência ou queries

### Escopo

- 1 arquivo: `src/hooks/useStageMovements.ts` (~20 linhas)
- Zero migration, zero mudança em componentes

